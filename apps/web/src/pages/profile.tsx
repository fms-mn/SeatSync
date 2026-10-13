import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { EmptyState, ErrorState, formatDate, formatTime, PageLoader, peso } from '../components';
import type { Booking } from '../types';

export function ProfilePage() {
  const { user } = useAuth(); const client = useQueryClient();
  const query = useQuery({ queryKey: ['bookings'], queryFn: () => api<{bookings: Booking[]}>('/bookings') });
  const cancel = useMutation({ mutationFn: (reference: string) => api(`/bookings/${reference}/cancel`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({queryKey:['bookings']}) });
  if (query.isLoading) return <PageLoader/>; if (!query.data) return <ErrorState/>;
  const active = query.data.bookings.filter((b) => b.status === 'CONFIRMED' && new Date(b.showtime.startsAt) > new Date());
  const history = query.data.bookings.filter((b) => !active.includes(b));
  return <div className="page profile-page"><div className="profile-header"><div className="avatar">{user?.name.slice(0,1).toUpperCase()}</div><div><p className="eyebrow">Your account</p><h1>{user?.name}</h1><p><Mail size={15}/>{user?.email}</p></div></div>
    <section className="profile-section"><div className="section-heading"><h2>Upcoming tickets <sup>{active.length}</sup></h2></div>{active.length ? <div className="booking-list">{active.map((booking) => <BookingRow key={booking.id} booking={booking} cancel={() => cancel.mutate(booking.reference)} busy={cancel.isPending}/>)}</div> : <EmptyState title="No upcoming shows" text="A great story is only a few clicks away."/>}</section>
    <section className="profile-section"><div className="section-heading"><h2>Booking history <sup>{history.length}</sup></h2></div>{history.length ? <div className="booking-list">{history.map((booking) => <BookingRow key={booking.id} booking={booking}/>)}</div> : <EmptyState title="No booking history yet" text="Your past tickets will appear here."/>}</section>
  </div>;
}

function BookingRow({ booking, cancel, busy }: { booking: Booking; cancel?: () => void; busy?: boolean }) {
  const cancellable = cancel && new Date(booking.showtime.startsAt).getTime() - Date.now() >= 2*60*60*1000;
  return <article className="booking-row"><img src={booking.showtime.movie.posterUrl} alt=""/><div className="booking-info"><span className={`booking-status ${booking.status.toLowerCase()}`}>{booking.status}</span><h3>{booking.showtime.movie.title}</h3><p><CalendarDays size={15}/>{formatDate(booking.showtime.startsAt)} · {formatTime(booking.showtime.startsAt)}</p><p><Ticket size={15}/>{booking.items.map((i) => `${i.seat.row}${i.seat.number}`).join(', ')} · {peso(booking.total)}</p></div><div className="booking-actions"><b>{booking.reference}</b><Link className="button button-small button-ghost" to={`/tickets/${booking.reference}`}>View ticket</Link>{cancellable && <button className="text-button danger" disabled={busy} onClick={cancel}>Cancel booking</button>}</div></article>;
}
