import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import QRCode from 'qrcode';
import { clearSession, issueSession, requireAdmin, requireAuth } from './auth.js';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { confirmBooking, createHold, seatMap } from './booking-service.js';
import { broadcastSeats } from './realtime.js';

const asyncRoute = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
const router = Router();

const publicUser = (user: { id: string; name: string; email: string; role: 'USER' | 'ADMIN' }) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

router.post('/auth/register', asyncRoute(async (req: any, res: any) => {
  const data = z.object({ name: z.string().trim().min(2).max(60), email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(8).max(128) }).parse(req.body);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12) } });
  issueSession(res, publicUser(user));
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/auth/login', asyncRoute(async (req: any, res: any) => {
  const data = z.object({ email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  issueSession(res, publicUser(user));
  res.json({ user: publicUser(user) });
}));
router.post('/auth/logout', (_req, res) => { clearSession(res); res.status(204).end(); });
router.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.get('/movies', asyncRoute(async (req: any, res: any) => {
  const status = z.enum(['NOW_SHOWING', 'UPCOMING']).optional().parse(req.query.status);
  const movies = await prisma.movie.findMany({
    where: status ? { status } : { status: { not: 'ARCHIVED' } },
    include: { showtimes: { where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, include: { auditorium: true } } },
    orderBy: [{ status: 'asc' }, { releaseDate: 'desc' }],
  });
  res.json({ movies: movies.map((m) => ({ ...m, showtimes: m.showtimes.map((s) => ({ ...s, price: Number(s.price) })) })) });
}));

router.get('/movies/:slug', asyncRoute(async (req: any, res: any) => {
  const movie = await prisma.movie.findUnique({ where: { slug: req.params.slug }, include: { showtimes: { where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, include: { auditorium: true } } } });
  if (!movie) throw new AppError(404, 'Movie not found', 'NOT_FOUND');
  res.json({ movie: { ...movie, showtimes: movie.showtimes.map((s) => ({ ...s, price: Number(s.price) })) } });
}));

router.get('/showtimes/:id/seats', asyncRoute(async (req: any, res: any) => res.json(await seatMap(req.params.id, req.user?.id))));
router.post('/reservations', requireAuth, asyncRoute(async (req: any, res: any) => {
  const data = z.object({ showtimeId: z.string().cuid(), seatIds: z.array(z.string().cuid()).min(1).max(10) }).parse(req.body);
  const hold = await createHold(req.user.id, data.showtimeId, data.seatIds);
  res.status(201).json({ reservation: hold });
}));
router.get('/reservations/:id', requireAuth, asyncRoute(async (req: any, res: any) => {
  const reservation = await prisma.reservation.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { seats: { include: { seat: true } }, showtime: { include: { movie: true, auditorium: true } }, booking: true },
  });
  if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND');
  res.json({ reservation: { ...reservation, showtime: { ...reservation.showtime, price: Number(reservation.showtime.price) } } });
}));
router.post('/bookings/confirm', requireAuth, asyncRoute(async (req: any, res: any) => {
  const { reservationId } = z.object({ reservationId: z.string().cuid() }).parse(req.body);
  const booking = await confirmBooking(req.user.id, reservationId);
  res.status(201).json({ booking });
}));

const bookingInclude = { showtime: { include: { movie: true, auditorium: true } }, items: { include: { showtimeSeat: { include: { seat: true } } } }, payment: true } as const;
router.get('/bookings', requireAuth, asyncRoute(async (req: any, res: any) => {
  const bookings = await prisma.booking.findMany({ where: { userId: req.user.id }, include: bookingInclude, orderBy: { createdAt: 'desc' } });
  res.json({ bookings: bookings.map(serializeBooking) });
}));
router.get('/bookings/:reference', requireAuth, asyncRoute(async (req: any, res: any) => {
  const booking = await prisma.booking.findFirst({ where: { reference: req.params.reference, ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id }) }, include: bookingInclude });
  if (!booking) throw new AppError(404, 'Booking not found', 'NOT_FOUND');
  const serialized = serializeBooking(booking);
  const qrCode = await QRCode.toDataURL(`${req.protocol}://${req.get('host')}/api/bookings/verify/${booking.reference}`, { margin: 1, width: 240 });
  res.json({ booking: serialized, qrCode });
}));
router.get('/bookings/verify/:reference', asyncRoute(async (req: any, res: any) => {
  const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference }, select: { reference: true, status: true, createdAt: true } });
  if (!booking) throw new AppError(404, 'Ticket not found', 'NOT_FOUND');
  res.json({ valid: booking.status === 'CONFIRMED', booking });
}));
router.post('/bookings/:reference/cancel', requireAuth, asyncRoute(async (req: any, res: any) => {
  const booking = await prisma.booking.findFirst({ where: { reference: req.params.reference, userId: req.user.id }, include: { showtime: true, items: true } });
  if (!booking) throw new AppError(404, 'Booking not found', 'NOT_FOUND');
  if (booking.status === 'CANCELLED') throw new AppError(409, 'Booking is already cancelled');
  if (booking.showtime.startsAt.getTime() - Date.now() < 2 * 60 * 60 * 1000) throw new AppError(409, 'Bookings can only be cancelled at least two hours before showtime', 'CANCELLATION_CLOSED');
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), payment: { update: { status: 'REFUNDED' } } } }),
    prisma.showtimeSeat.updateMany({ where: { id: { in: booking.items.map((i) => i.showtimeSeatId) }, status: 'BOOKED' }, data: { status: 'AVAILABLE', reservationId: null, version: { increment: 1 } } }),
  ]);
  broadcastSeats(booking.showtimeId);
  res.status(204).end();
}));

function serializeBooking(booking: any) {
  return { ...booking, total: Number(booking.total), showtime: { ...booking.showtime, price: Number(booking.showtime.price) }, items: booking.items.map((i: any) => ({ ...i, price: Number(i.price), seat: i.showtimeSeat.seat })) };
}

router.get('/admin/stats', requireAuth, requireAdmin, asyncRoute(async (_req: any, res: any) => {
  const [revenue, bookings, activeHolds, movies, occupancy] = await Promise.all([
    prisma.booking.aggregate({ where: { status: 'CONFIRMED' }, _sum: { total: true } }),
    prisma.booking.count({ where: { status: 'CONFIRMED' } }),
    prisma.reservation.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    prisma.movie.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.showtimeSeat.groupBy({ by: ['status'], _count: true }),
  ]);
  res.json({ revenue: Number(revenue._sum.total ?? 0), bookings, activeHolds, movies, occupancy });
}));
router.get('/admin/bookings', requireAuth, requireAdmin, asyncRoute(async (_req: any, res: any) => {
  const bookings = await prisma.booking.findMany({ include: { user: { select: { name: true, email: true } }, showtime: { include: { movie: true } }, items: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ bookings: bookings.map((b) => ({ ...b, total: Number(b.total) })) });
}));

const movieSchema = z.object({ title: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]+$/), synopsis: z.string().min(10), genre: z.string().min(1), duration: z.number().int().positive(), rating: z.string().min(1), score: z.number().min(0).max(10), posterUrl: z.string().url(), backdropUrl: z.string().url(), releaseDate: z.coerce.date(), status: z.enum(['NOW_SHOWING', 'UPCOMING', 'ARCHIVED']) });
router.post('/admin/movies', requireAuth, requireAdmin, asyncRoute(async (req: any, res: any) => res.status(201).json({ movie: await prisma.movie.create({ data: movieSchema.parse(req.body) }) })));
router.patch('/admin/movies/:id', requireAuth, requireAdmin, asyncRoute(async (req: any, res: any) => res.json({ movie: await prisma.movie.update({ where: { id: req.params.id }, data: movieSchema.partial().parse(req.body) }) })));

router.get('/admin/auditoriums', requireAuth, requireAdmin, asyncRoute(async (_req: any, res: any) => res.json({ auditoriums: await prisma.auditorium.findMany({ include: { _count: { select: { seats: true } } } }) })));
router.post('/admin/auditoriums', requireAuth, requireAdmin, asyncRoute(async (req: any, res: any) => {
  const { name } = z.object({ name: z.string().trim().min(2) }).parse(req.body);
  const auditorium = await prisma.auditorium.create({ data: { name, seats: { create: Array.from({ length: 80 }, (_, index) => ({ row: String.fromCharCode(65 + Math.floor(index / 10)), number: (index % 10) + 1 })) } } });
  res.status(201).json({ auditorium });
}));
router.post('/admin/showtimes', requireAuth, requireAdmin, asyncRoute(async (req: any, res: any) => {
  const data = z.object({ movieId: z.string().cuid(), auditoriumId: z.string().cuid(), startsAt: z.coerce.date(), price: z.number().positive() }).parse(req.body);
  const seats = await prisma.seat.findMany({ where: { auditoriumId: data.auditoriumId }, select: { id: true } });
  if (seats.length !== 80) throw new AppError(409, 'Auditorium must have exactly 80 seats');
  const showtime = await prisma.showtime.create({ data: { ...data, seats: { create: seats.map((seat) => ({ seatId: seat.id })) } } });
  res.status(201).json({ showtime: { ...showtime, price: Number(showtime.price) } });
}));

export default router;
