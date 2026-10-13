import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { releaseExpired } from './booking-service.js';
import { setRealtimeServer } from './realtime.js';

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.CLIENT_URL, credentials: true } });
setRealtimeServer(io);

io.on('connection', (socket) => {
  socket.on('showtime:join', (showtimeId: string) => {
    if (typeof showtimeId === 'string' && showtimeId.length < 64) socket.join(`showtime:${showtimeId}`);
  });
  socket.on('showtime:leave', (showtimeId: string) => socket.leave(`showtime:${showtimeId}`));
});

const cleanup = setInterval(() => releaseExpired().catch(console.error), 15_000);
cleanup.unref();
httpServer.listen(config.PORT, () => console.log(`SeatSync API listening on http://localhost:${config.PORT}`));

async function shutdown() {
  clearInterval(cleanup);
  io.close();
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
