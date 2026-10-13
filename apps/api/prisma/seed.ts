import '../src/load-env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const day = (offset: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const movies = [
  {
    title: 'Echoes of Orion', slug: 'echoes-of-orion', genre: 'Sci-Fi · Adventure', duration: 142, rating: 'PG-13', score: 8.7,
    synopsis: 'A deep-space cartographer receives a transmission from a star that vanished centuries ago, pulling her crew toward an impossible discovery.',
    posterUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=85',
    backdropUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1800&q=85',
    releaseDate: day(-12, 0), status: 'NOW_SHOWING' as const,
  },
  {
    title: 'The Last Frequency', slug: 'the-last-frequency', genre: 'Thriller · Mystery', duration: 118, rating: 'R-13', score: 8.2,
    synopsis: 'A late-night radio host hears a caller predict crimes minutes before they happen—and realizes the final prediction is about her.',
    posterUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=85',
    backdropUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1800&q=85',
    releaseDate: day(-5, 0), status: 'NOW_SHOWING' as const,
  },
  {
    title: 'Paper Moons', slug: 'paper-moons', genre: 'Drama · Romance', duration: 106, rating: 'PG', score: 7.9,
    synopsis: 'Two rival illustrators inherit a forgotten print shop and discover a box of letters that changes what they believe about love and ambition.',
    posterUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=85',
    backdropUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1800&q=85',
    releaseDate: day(-20, 0), status: 'NOW_SHOWING' as const,
  },
  {
    title: 'Wild Meridian', slug: 'wild-meridian', genre: 'Adventure · Drama', duration: 134, rating: 'PG-13', score: 8.4,
    synopsis: 'A climate scientist and a wilderness guide race across an uncharted valley before a once-in-a-century storm redraws the map forever.',
    posterUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=85',
    backdropUrl: 'https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1800&q=85',
    releaseDate: day(18, 0), status: 'UPCOMING' as const,
  },
];

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminPassword && adminPassword.length >= 8) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: 'admin@seatsync.dev' },
      update: { passwordHash },
      create: { name: 'SeatSync Admin', email: 'admin@seatsync.dev', passwordHash, role: 'ADMIN' },
    });
  } else {
    console.warn('ADMIN_SEED_PASSWORD is unset or too short; skipped the development admin account.');
  }
  const auditorium = await prisma.auditorium.upsert({
    where: { name: 'Lumière Hall 1' }, update: {}, create: { name: 'Lumière Hall 1' },
  });
  await prisma.seat.createMany({
    data: Array.from({ length: 80 }, (_, index) => ({ auditoriumId: auditorium.id, row: String.fromCharCode(65 + Math.floor(index / 10)), number: (index % 10) + 1 })),
    skipDuplicates: true,
  });
  const seats = await prisma.seat.findMany({ where: { auditoriumId: auditorium.id } });

  for (const [movieIndex, movieData] of movies.entries()) {
    const movie = await prisma.movie.upsert({ where: { slug: movieData.slug }, update: movieData, create: movieData });
    if (movie.status === 'NOW_SHOWING') {
      for (const [offset, baseHour] of [[1, 13], [2, 13], [3, 13], [4, 13]] as const) {
        const hour = baseHour + movieIndex * 3;
        const startsAt = day(offset, hour);
        const existing = await prisma.showtime.findUnique({ where: { auditoriumId_startsAt: { auditoriumId: auditorium.id, startsAt } } });
        if (!existing) {
          await prisma.showtime.create({
            data: { movieId: movie.id, auditoriumId: auditorium.id, startsAt, price: hour >= 18 ? 420 : 350, seats: { create: seats.map((seat) => ({ seatId: seat.id })) } },
          });
        }
      }
    }
  }
  console.log('Seeded SeatSync with 4 movies, 80 seats, and showtimes.');
}

main().finally(() => prisma.$disconnect());
