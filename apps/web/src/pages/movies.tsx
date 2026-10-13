import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock3, Radio, ShieldCheck, Sparkles, Star, Ticket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorState, formatDate, formatTime, PageLoader, peso } from '../components';
import type { Movie } from '../types';

const useMovies = () => useQuery({ queryKey: ['movies'], queryFn: () => api<{ movies: Movie[] }>('/movies') });

function MovieCard({ movie }: { movie: Movie }) {
  return <Link to={`/movies/${movie.slug}`} className="movie-card">
    <div className="poster-wrap"><img src={movie.posterUrl} alt={`${movie.title} poster`} /><span className="score"><Star size={13} fill="currentColor" />{movie.score}</span>{movie.status === 'UPCOMING' && <span className="status-pill">Coming soon</span>}</div>
    <div className="movie-card-copy"><p className="eyebrow">{movie.genre}</p><h3>{movie.title}</h3><p>{movie.duration} min · {movie.rating}</p></div>
  </Link>;
}

export function HomePage() {
  const query = useMovies();
  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) return <ErrorState />;
  const featured = query.data.movies.find((m) => m.status === 'NOW_SHOWING')!;
  const now = query.data.movies.filter((m) => m.status === 'NOW_SHOWING');
  return <>
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,8,10,.98) 5%,rgba(7,8,10,.7) 52%,rgba(7,8,10,.18)), url(${featured.backdropUrl})` }}>
      <div className="hero-content"><p className="eyebrow accent">Now showing · Editor's pick</p><h1>Stories feel bigger<br/>from the <em>right seat.</em></h1><p className="hero-lead">{featured.synopsis}</p>
        <div className="movie-meta"><span><Star size={16} fill="currentColor"/> {featured.score}</span><span>{featured.genre}</span><span>{featured.duration} min</span></div>
        <div className="actions"><Link className="button" to={`/movies/${featured.slug}`}><Ticket size={18}/>Book tickets</Link><Link className="button button-ghost" to="/movies">Browse all films</Link></div>
      </div><div className="hero-index">01 <span>/ {String(now.length).padStart(2, '0')}</span></div>
    </section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">On the big screen</p><h2>Now showing</h2></div><Link className="inline-link" to="/movies">View all <ArrowRight size={16}/></Link></div>
      <div className="movie-grid">{now.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
    </section>
    <section className="promise"><div><Radio/><h3>Live seat availability</h3><p>Every seat updates the instant it’s held or booked.</p></div><div><ShieldCheck/><h3>Reserved with confidence</h3><p>Database-backed holds keep your selection yours for five minutes.</p></div><div><Sparkles/><h3>No checkout surprises</h3><p>Clear pricing, simulated payment, and an instant digital ticket.</p></div></section>
  </>;
}

export function MoviesPage() {
  const query = useMovies();
  if (query.isLoading) return <PageLoader/>;
  if (!query.data) return <ErrorState/>;
  const now = query.data.movies.filter((m) => m.status === 'NOW_SHOWING');
  const upcoming = query.data.movies.filter((m) => m.status === 'UPCOMING');
  return <div className="page"><div className="page-intro"><p className="eyebrow accent">Curated for the cinema</p><h1>Find your next <em>great story.</em></h1><p>From first frames to final credits, discover what’s playing and choose the perfect time.</p></div>
    <section className="catalog-section"><div className="section-heading"><h2>Now showing <sup>{now.length}</sup></h2></div><div className="movie-grid">{now.map((m) => <MovieCard key={m.id} movie={m}/>)}</div></section>
    <section className="catalog-section"><div className="section-heading"><h2>Coming soon <sup>{upcoming.length}</sup></h2></div><div className="movie-grid">{upcoming.map((m) => <MovieCard key={m.id} movie={m}/>)}</div></section>
  </div>;
}

export function MoviePage() {
  const { slug } = useParams();
  const query = useQuery({ queryKey: ['movie', slug], queryFn: () => api<{ movie: Movie }>(`/movies/${slug}`) });
  if (query.isLoading) return <PageLoader/>;
  if (!query.data) return <ErrorState message="We couldn't find that film."/>;
  const movie = query.data.movie;
  const grouped = movie.showtimes.reduce<Record<string, typeof movie.showtimes>>((days, showtime) => {
    const key = new Date(showtime.startsAt).toDateString();
    (days[key] ??= []).push(showtime);
    return days;
  }, {});
  return <div className="detail-page">
    <section className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,8,10,.98),rgba(7,8,10,.45)),url(${movie.backdropUrl})` }}><div className="detail-content"><Link to="/movies" className="back-link">← All movies</Link><p className="eyebrow accent">{movie.status === 'NOW_SHOWING' ? 'Now showing' : 'Coming soon'}</p><h1>{movie.title}</h1><div className="movie-meta"><span><Star size={16} fill="currentColor"/> {movie.score}/10</span><span><Clock3 size={16}/>{movie.duration} min</span><span>{movie.rating}</span></div><p>{movie.synopsis}</p></div></section>
    <section className="showtime-section"><div><p className="eyebrow">Choose your session</p><h2>Showtimes</h2></div>{movie.status === 'UPCOMING' ? <div className="empty"><h3>Arriving {formatDate(movie.releaseDate)}</h3><p>Showtimes will be announced soon.</p></div> : Object.entries(grouped).map(([date, times]) => <div className="date-row" key={date}><div><strong>{new Date(date).toLocaleDateString('en-PH',{weekday:'short'})}</strong><span>{new Date(date).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span></div><div className="time-list">{times.map((time) => <Link key={time.id} to={`/showtimes/${time.id}/seats`} className="time-card"><b>{formatTime(time.startsAt)}</b><span>{time.auditorium.name}</span><small>from {peso(time.price)}</small></Link>)}</div></div>)}</section>
  </div>;
}

export function AboutPage() { return <div className="page narrow"><div className="page-intro"><p className="eyebrow accent">The SeatSync experience</p><h1>Booking without the <em>balcony drama.</em></h1><p>SeatSync pairs a calm, premium interface with a concurrency-safe booking engine. What you see is the same authoritative availability every other guest sees.</p></div><section className="prose-card"><h2>How your seat stays yours</h2><ol><li><b>Choose.</b> Browse live availability for a specific showtime.</li><li><b>Hold.</b> Your seats are atomically reserved in PostgreSQL for five minutes.</li><li><b>Confirm.</b> Complete simulated checkout before the timer ends.</li><li><b>Enjoy.</b> Your QR ticket and booking reference are ready immediately.</li></ol></section></div>; }
