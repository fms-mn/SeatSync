import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

let showtimeId: string;
let seats: string[];
const stamp = Date.now();
const emailA = `a-${stamp}@example.com`;
const emailB = `b-${stamp}@example.com`;
const userA = request.agent(app);
const userB = request.agent(app);

beforeAll(async () => {
  const auditorium = await prisma.auditorium.create({ data: { name: `Test Hall ${Date.now()}`, seats: { create: Array.from({length:80},(_,i)=>({row:String.fromCharCode(65+Math.floor(i/10)),number:i%10+1})) } } });
  const movie = await prisma.movie.create({ data: { title:'Test Feature',slug:`test-feature-${Date.now()}`,synopsis:'A sufficiently descriptive test movie synopsis.',genre:'Drama',duration:100,rating:'PG',score:8,posterUrl:'https://example.com/poster.jpg',backdropUrl:'https://example.com/backdrop.jpg',releaseDate:new Date(),status:'NOW_SHOWING' } });
  const auditoriumSeats = await prisma.seat.findMany({where:{auditoriumId:auditorium.id}});
  const showtime = await prisma.showtime.create({ data: { movieId:movie.id,auditoriumId:auditorium.id,startsAt:new Date(Date.now()+86_400_000),price:300,seats:{create:auditoriumSeats.map(s=>({seatId:s.id}))} } });
  showtimeId=showtime.id; seats=(await prisma.showtimeSeat.findMany({where:{showtimeId},orderBy:{seat:{number:'asc'}},take:5})).map(s=>s.id);
  await userA.post('/api/auth/register').send({name:'Test User A',email:emailA,password:'Password123!'}).expect(201);
  await userB.post('/api/auth/register').send({name:'Test User B',email:emailB,password:'Password123!'}).expect(201);
});
afterAll(() => prisma.$disconnect());

describe('authentication and authorization', () => {
  it('persists a secure session and protects admin routes', async () => {
    const me = await userA.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toContain('@example.com');
    await userA.get('/api/admin/stats').expect(403);
    await request(app).get('/api/bookings').expect(401);
  });
  it('logs in with a hashed password and retrieves movies and showtimes', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({email:emailA,password:'Password123!'}).expect(200);
    const catalog = await agent.get('/api/movies').expect(200);
    expect(catalog.body.movies.some((movie:any)=>movie.title==='Test Feature')).toBe(true);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('concurrency-safe booking engine', () => {
  it('allows exactly one of two simultaneous users to hold the same seat', async () => {
    const attempts = await Promise.all([
      userA.post('/api/reservations').send({showtimeId,seatIds:[seats[0]]}),
      userB.post('/api/reservations').send({showtimeId,seatIds:[seats[0]]}),
    ]);
    expect(attempts.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await prisma.showtimeSeat.count({where:{id:seats[0],status:'HELD'}})).toBe(1);
  });

  it('atomically holds multiple seats and confirms only the owner', async () => {
    const held = await userA.post('/api/reservations').send({showtimeId,seatIds:[seats[1],seats[2]]}).expect(201);
    await userB.post('/api/bookings/confirm').send({reservationId:held.body.reservation.id}).expect(404);
    const booked = await userA.post('/api/bookings/confirm').send({reservationId:held.body.reservation.id}).expect(201);
    expect(booked.body.booking.reference).toMatch(/^SS-/);
    expect(await prisma.showtimeSeat.count({where:{id:{in:[seats[1],seats[2]]},status:'BOOKED'}})).toBe(2);
    const duplicate = await userA.post('/api/bookings/confirm').send({reservationId:held.body.reservation.id}).expect(201);
    expect(duplicate.body.booking.reference).toBe(booked.body.booking.reference);
    expect(await prisma.booking.count({where:{reservationId:held.body.reservation.id}})).toBe(1);
  });

  it('rejects an expired hold and releases inventory', async () => {
    const held = await userB.post('/api/reservations').send({showtimeId,seatIds:[seats[3]]}).expect(201);
    const expired = new Date(Date.now()-1000);
    await prisma.reservation.update({where:{id:held.body.reservation.id},data:{expiresAt:expired}});
    await prisma.showtimeSeat.update({where:{id:seats[3]},data:{holdExpiresAt:expired}});
    await userB.post('/api/bookings/confirm').send({reservationId:held.body.reservation.id}).expect(409);
    const map = await userB.get(`/api/showtimes/${showtimeId}/seats`).expect(200);
    expect(map.body.seats.find((s:any)=>s.id===seats[3]).status).toBe('AVAILABLE');
  });

  it('rolls back the entire hold when any requested seat is unavailable', async () => {
    await userB.post('/api/reservations').send({showtimeId,seatIds:[seats[1],seats[4]]}).expect(409);
    expect(await prisma.showtimeSeat.findUnique({where:{id:seats[4]}})).toMatchObject({status:'AVAILABLE'});
  });
});
