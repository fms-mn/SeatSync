export type Role = 'USER' | 'ADMIN';
export interface User { id: string; name: string; email: string; role: Role }
export interface Auditorium { id: string; name: string }
export interface Showtime { id: string; startsAt: string; price: number; auditorium: Auditorium }
export interface Movie {
  id: string; title: string; slug: string; synopsis: string; genre: string; duration: number;
  rating: string; score: number; posterUrl: string; backdropUrl: string; releaseDate: string;
  status: 'NOW_SHOWING' | 'UPCOMING' | 'ARCHIVED'; showtimes: Showtime[];
}
export interface Seat { id: string; label: string; row: string; number: number; status: 'AVAILABLE' | 'HELD' | 'BOOKED'; isMine: boolean; holdExpiresAt: string | null }
export interface Reservation { id: string; status: 'ACTIVE'|'EXPIRED'|'CONFIRMED'|'CANCELLED'; expiresAt: string; seats: Array<{ id: string; seat: { row: string; number: number } }>; showtime: Showtime & { movie: Movie } }
export interface Booking {
  id: string; reference: string; status: 'CONFIRMED' | 'CANCELLED'; total: number; createdAt: string;
  showtime: Showtime & { movie: Movie }; items: Array<{ id: string; price: number; seat: { row: string; number: number } }>;
}
