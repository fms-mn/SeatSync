import type { Server } from 'socket.io';

let io: Server | undefined;
export const setRealtimeServer = (server: Server) => { io = server; };
export const broadcastSeats = (showtimeId: string) => io?.to(`showtime:${showtimeId}`).emit('seats:changed', { showtimeId });
export const broadcastActivity = (payload: unknown) => io?.to('admin').emit('reservation:activity', payload);
