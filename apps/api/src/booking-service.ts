import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { broadcastActivity, broadcastSeats } from './realtime.js';

const HOLD_MS = 5 * 60 * 1000;
const txOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 } as const;

export async function releaseExpired(showtimeId?: string) {
  const now = new Date();
  const expired = await prisma.$transaction(async (tx) => {
    const reservations = await tx.reservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now }, ...(showtimeId ? { showtimeId } : {}) },
      select: { id: true, showtimeId: true },
    });
    if (!reservations.length) return [];
    const ids = reservations.map((r) => r.id);
    await tx.showtimeSeat.updateMany({
      where: { reservationId: { in: ids }, status: 'HELD' },
      data: { status: 'AVAILABLE', reservationId: null, holdExpiresAt: null, version: { increment: 1 } },
    });
    await tx.reservation.updateMany({ where: { id: { in: ids }, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
    return [...new Set(reservations.map((r) => r.showtimeId))];
  }, txOptions);
  expired.forEach(broadcastSeats);
  return expired.length;
}

export async function seatMap(showtimeId: string, userId?: string) {
  await releaseExpired(showtimeId);
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: { movie: true, auditorium: true, seats: { include: { seat: true }, orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }] } },
  });
  if (!showtime) throw new AppError(404, 'Showtime not found', 'NOT_FOUND');
  return {
    showtime: { id: showtime.id, startsAt: showtime.startsAt, price: Number(showtime.price), movie: showtime.movie, auditorium: showtime.auditorium },
    seats: showtime.seats.map((item) => ({
      id: item.id,
      label: `${item.seat.row}${item.seat.number}`,
      row: item.seat.row,
      number: item.seat.number,
      status: item.status,
      isMine: false,
      holdExpiresAt: item.status === 'HELD' ? item.holdExpiresAt : null,
    })),
    activeReservation: userId ? await prisma.reservation.findFirst({
      where: { userId, showtimeId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { seats: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    }) : null,
  };
}

export async function createHold(userId: string, showtimeId: string, seatIds: string[]) {
  if (new Set(seatIds).size !== seatIds.length) throw new AppError(400, 'Duplicate seat IDs are not allowed');
  const expiresAt = new Date(Date.now() + HOLD_MS);
  let reservation;
  try {
    reservation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ShowtimeSeat" WHERE "showtimeId" = ${showtimeId} AND id IN (${Prisma.join(seatIds)}) FOR UPDATE`;
      const now = new Date();
      const requested = await tx.showtimeSeat.findMany({ where: { id: { in: seatIds }, showtimeId } });
      if (requested.length !== seatIds.length) throw new AppError(400, 'One or more seats do not belong to this showtime');

      const staleIds = requested.filter((s) => s.status === 'HELD' && s.holdExpiresAt && s.holdExpiresAt <= now).map((s) => s.id);
      if (staleIds.length) {
        await tx.showtimeSeat.updateMany({ where: { id: { in: staleIds }, status: 'HELD' }, data: { status: 'AVAILABLE', reservationId: null, holdExpiresAt: null, version: { increment: 1 } } });
      }
      const unavailable = requested.filter((s) => !staleIds.includes(s.id) && s.status !== 'AVAILABLE');
      if (unavailable.length) throw new AppError(409, 'One or more seats are no longer available', 'SEAT_CONFLICT');

      await tx.reservation.updateMany({ where: { userId, showtimeId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
      await tx.showtimeSeat.updateMany({
        where: { showtimeId, reservation: { userId, status: 'CANCELLED' }, status: 'HELD' },
        data: { status: 'AVAILABLE', reservationId: null, holdExpiresAt: null, version: { increment: 1 } },
      });
      const created = await tx.reservation.create({ data: { userId, showtimeId, expiresAt } });
      const updated = await tx.showtimeSeat.updateMany({
        where: { id: { in: seatIds }, showtimeId, status: 'AVAILABLE' },
        data: { status: 'HELD', reservationId: created.id, holdExpiresAt: expiresAt, version: { increment: 1 } },
      });
      if (updated.count !== seatIds.length) throw new AppError(409, 'Seat availability changed', 'SEAT_CONFLICT');
      return tx.reservation.findUniqueOrThrow({ where: { id: created.id }, include: { seats: { include: { seat: true } }, showtime: { include: { movie: true, auditorium: true } } } });
    }, txOptions);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new AppError(409, 'Seats changed while reserving. Please try again.', 'SEAT_CONFLICT');
    throw error;
  }
  broadcastSeats(showtimeId);
  broadcastActivity({ type: 'HOLD_CREATED', showtimeId, reservationId: reservation.id });
  return reservation;
}

export async function confirmBooking(userId: string, reservationId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;
    const reservation = await tx.reservation.findFirst({
      where: { id: reservationId, userId },
      include: { seats: true, showtime: true, booking: true },
    });
    if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND');
    if (reservation.booking) return reservation.booking;
    if (reservation.status !== 'ACTIVE' || reservation.expiresAt <= new Date()) throw new AppError(409, 'Reservation has expired', 'HOLD_EXPIRED');
    if (!reservation.seats.length || reservation.seats.some((s) => s.status !== 'HELD' || s.reservationId !== reservation.id)) throw new AppError(409, 'Reservation is no longer valid', 'INVALID_HOLD');

    const total = Number(reservation.showtime.price) * reservation.seats.length;
    const reference = `SS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const booking = await tx.booking.create({
      data: {
        reference, userId, showtimeId: reservation.showtimeId, reservationId, total,
        items: { create: reservation.seats.map((s) => ({ showtimeSeatId: s.id, price: reservation.showtime.price })) },
        payment: { create: { amount: total } },
      },
    });
    await tx.showtimeSeat.updateMany({
      where: { reservationId, status: 'HELD' },
      data: { status: 'BOOKED', holdExpiresAt: null, version: { increment: 1 } },
    });
    await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CONFIRMED' } });
    return booking;
  }, txOptions);
  broadcastSeats(result.showtimeId);
  broadcastActivity({ type: 'BOOKING_CONFIRMED', showtimeId: result.showtimeId, reference: result.reference });
  return result;
}
