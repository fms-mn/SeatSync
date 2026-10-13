export type Role = 'USER' | 'ADMIN';
export type SeatState = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface ApiError { message: string; code?: string; issues?: unknown }
export interface AuthUser { id: string; name: string; email: string; role: Role }
export interface SeatView {
  id: string;
  label: string;
  row: string;
  number: number;
  status: SeatState;
  isMine: boolean;
  holdExpiresAt: string | null;
}
