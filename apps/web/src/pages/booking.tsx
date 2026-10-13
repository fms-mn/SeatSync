import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, Check, ChevronLeft, Clock3, Printer, Radio, ShieldCheck, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, API_URL } from '../api';
import { useAuth } from '../auth';
import { ErrorState, formatDate, formatTime, PageLoader, peso } from '../components';
import type { Booking, Movie, Reservation, Seat, Showtime } from '../types';

interface SeatMap { showtime: Showtime & { movie: Movie }; seats: Seat[]; activeReservation: { id: string; expiresAt: string; seats: Array<{id:string}> } | null }

function Countdown({ until, onExpire }: { until: string; onExpire?: () => void }) {
  const [left, setLeft] = useState(Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => { const timer = setInterval(() => { const next = Math.max(0, new Date(until).getTime() - Date.now()); setLeft(next); if (!next) onExpire?.(); }, 1000); return () => clearInterval(timer); }, [until, onExpire]);
  const minutes = Math.floor(left / 60000); const seconds = Math.floor((left % 60000) / 1000);
  return <span className={left < 60_000 ? 'countdown urgent' : 'countdown'}><Clock3 size={16}/>{minutes}:{seconds.toString().padStart(2,'0')}</span>;
}

export function SeatsPage() {
  const { id = '' } = useParams(); const { user } = useAuth(); const navigate = useNavigate(); const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]); const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['seats', id], queryFn: () => api<SeatMap>(`/showtimes/${id}/seats`), refetchOnWindowFocus: true });
  useEffect(() => {
    const socket = io(API_URL, { withCredentials: true });
    const refresh = () => client.invalidateQueries({ queryKey: ['seats', id] });
    socket.emit('showtime:join', id); socket.on('seats:changed', refresh); socket.on('connect', refresh);
    return () => { socket.emit('showtime:leave', id); socket.disconnect(); };
  }, [id, client]);
  const hold = useMutation({ mutationFn: () => api<{ reservation: Reservation }>('/reservations', { method: 'POST', body: JSON.stringify({ showtimeId: id, seatIds: selected }) }), onSuccess: ({ reservation }) => navigate(`/checkout/${reservation.id}`), onError: (err) => { setError(err instanceof Error ? err.message : 'Could not hold seats'); client.invalidateQueries({ queryKey: ['seats', id] }); } });
  if (query.isLoading) return <PageLoader/>; if (!query.data) return <ErrorState/>;
  const { showtime, seats, activeReservation } = query.data;
  const mine = new Set(activeReservation?.seats.map((s) => s.id));
  const toggle = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return;
    setError(''); setSelected((current) => current.includes(seat.id) ? current.filter((item) => item !== seat.id) : current.length < 10 ? [...current, seat.id] : current);
  };
  const selectedSeats = seats.filter((s) => selected.includes(s.id));
  return <div className="booking-page"><div className="booking-top"><Link to={`/movies/${showtime.movie.slug}`} className="back-link"><ChevronLeft size={17}/> Back to showtimes</Link><div><p className="eyebrow">Select your seats</p><h1>{showtime.movie.title}</h1><p>{formatDate(showtime.startsAt)} · {formatTime(showtime.startsAt)} · {showtime.auditorium.name}</p></div><span className="live-badge"><Radio size={14}/>Live availability</span></div>
    {activeReservation && <div className="hold-banner"><span>You already have seats on hold.</span><Countdown until={activeReservation.expiresAt}/><Link className="button button-small" to={`/checkout/${activeReservation.id}`}>Continue checkout</Link></div>}
    <div className="seat-layout"><section className="seat-map" aria-label="Cinema seating plan"><div className="screen"><span>SCREEN</span></div><div className="seats">{Array.from({length:8},(_,r) => String.fromCharCode(65+r)).map((row) => <div className="seat-row" key={row}><b>{row}</b>{seats.filter((s) => s.row === row).map((seat) => { const status = mine.has(seat.id) ? 'mine' : selected.includes(seat.id) ? 'selected' : seat.status.toLowerCase(); return <button key={seat.id} className={`seat ${status}`} disabled={seat.status !== 'AVAILABLE'} onClick={() => toggle(seat)} aria-label={`Seat ${seat.label}, ${status}`} aria-pressed={selected.includes(seat.id)}><span>{seat.number}</span></button>;})}<b>{row}</b></div>)}</div><div className="legend"><span><i className="seat-dot available"/>Available</span><span><i className="seat-dot selected"/>Selected</span><span><i className="seat-dot held"/>Held</span><span><i className="seat-dot booked"/>Booked</span></div></section>
      <aside className="selection-card"><p className="eyebrow">Your selection</p><h2>{selected.length ? `${selected.length} seat${selected.length > 1 ? 's' : ''}` : 'Choose a seat'}</h2>{selected.length ? <><div className="selected-chips">{selectedSeats.map((s) => <button key={s.id} onClick={() => toggle(s)}>{s.label} ×</button>)}</div><div className="price-row"><span>Tickets × {selected.length}</span><b>{peso(showtime.price * selected.length)}</b></div><div className="price-total"><span>Total</span><strong>{peso(showtime.price * selected.length)}</strong></div></> : <p className="muted">Pick up to 10 available seats from the map. Your total will update here.</p>}{error && <div className="form-error">{error}</div>}<button className="button button-wide" disabled={!selected.length || hold.isPending} onClick={() => user ? hold.mutate() : navigate('/login')}>{hold.isPending ? 'Securing seats…' : user ? 'Hold seats for 5 minutes' : 'Sign in to reserve'}</button><p className="fine-print"><ShieldCheck size={15}/>Your selection is verified by the server before it is held.</p></aside>
    </div></div>;
}

export function CheckoutPage() {
  const { reservationId = '' } = useParams(); const navigate = useNavigate(); const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['reservation', reservationId], queryFn: () => api<{ reservation: Reservation }>(`/reservations/${reservationId}`), refetchInterval: 15_000 });
  const confirm = useMutation({ mutationFn: () => api<{ booking: Booking }>('/bookings/confirm', { method: 'POST', body: JSON.stringify({ reservationId }) }), onSuccess: ({ booking }) => navigate(`/tickets/${booking.reference}`, { replace: true }), onError: (err) => setError(err instanceof Error ? err.message : 'Checkout failed') });
  if (query.isLoading) return <PageLoader/>; if (!query.data) return <ErrorState message="This reservation could not be loaded."/>;
  const r = query.data.reservation; const total = r.seats.length * r.showtime.price; const expired = r.status !== 'ACTIVE' || new Date(r.expiresAt) <= new Date();
  return <div className="page checkout-page"><div className="checkout-heading"><div><p className="eyebrow accent">Almost yours</p><h1>Review & confirm</h1></div><Countdown until={r.expiresAt} onExpire={() => query.refetch()}/></div><div className="checkout-grid"><section className="order-card"><img src={r.showtime.movie.posterUrl} alt=""/><div><p className="eyebrow">{r.showtime.movie.genre}</p><h2>{r.showtime.movie.title}</h2><p>{formatDate(r.showtime.startsAt)} at {formatTime(r.showtime.startsAt)}</p><p>{r.showtime.auditorium.name}</p><div className="ticket-seats"><Armchair size={17}/>{r.seats.map((s) => `${s.seat.row}${s.seat.number}`).join(', ')}</div></div></section><aside className="summary-card"><h2>Order summary</h2><div className="price-row"><span>Tickets × {r.seats.length}</span><b>{peso(total)}</b></div><div className="price-row"><span>Booking fee</span><b>Free</b></div><div className="price-total"><span>Total</span><strong>{peso(total)}</strong></div><div className="mock-payment"><ShieldCheck/><div><b>Secure simulated checkout</b><p>No card details are collected. Clicking below creates a simulated successful payment.</p></div></div>{error && <div className="form-error">{error}</div>}<button className="button button-wide" disabled={confirm.isPending || expired} onClick={() => confirm.mutate()}>{expired ? 'Reservation expired' : confirm.isPending ? 'Confirming…' : `Confirm & pay ${peso(total)}`}</button></aside></div></div>;
}

export function TicketPage() {
  const { reference = '' } = useParams();
  const query = useQuery({ queryKey: ['booking', reference], queryFn: () => api<{ booking: Booking; qrCode: string }>(`/bookings/${reference}`) });
  if (query.isLoading) return <PageLoader/>; if (!query.data) return <ErrorState message="Ticket not found."/>;
  const { booking, qrCode } = query.data;
  return <div className="page ticket-page"><div className="success-mark"><Check/></div><p className="eyebrow accent">Booking confirmed</p><h1>You’re going to the movies.</h1><p>Your digital ticket is ready. We’ve also saved it to your profile.</p><article className="digital-ticket"><div className="ticket-main"><div className="ticket-brand">SEAT<span>SYNC</span><small>ADMIT {booking.items.length}</small></div><p className="eyebrow">{booking.showtime.movie.genre}</p><h2>{booking.showtime.movie.title}</h2><div className="ticket-grid"><div><span>Date</span><b>{formatDate(booking.showtime.startsAt)}</b></div><div><span>Time</span><b>{formatTime(booking.showtime.startsAt)}</b></div><div><span>Auditorium</span><b>{booking.showtime.auditorium.name}</b></div><div><span>Seats</span><b>{booking.items.map((i) => `${i.seat.row}${i.seat.number}`).join(', ')}</b></div></div><p className="ticket-ref">Booking reference <b>{booking.reference}</b></p></div><div className="ticket-stub"><img src={qrCode} alt={`QR verification code for ${booking.reference}`}/><b>{peso(booking.total)}</b><span>Present at entry</span></div></article><div className="actions center"><button className="button button-ghost" onClick={() => print()}><Printer size={17}/>Print ticket</button><Link className="button" to="/profile"><Ticket size={17}/>View my bookings</Link></div></div>;
}
