import { Clapperboard, Menu, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from './auth';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="header"><Link className="brand" to="/"><span className="brand-mark"><Clapperboard size={19} /></span>SEAT<span>SYNC</span></Link>
      <button className="icon-button mobile-only" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
      <nav className={open ? 'nav open' : 'nav'} onClick={() => setOpen(false)}>
        <NavLink to="/movies">Movies</NavLink><NavLink to="/about">Experience</NavLink>
        {user?.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        {user ? <><NavLink className="profile-link" to="/profile"><UserRound size={16} />{user.name.split(' ')[0]}</NavLink><button className="text-button" onClick={() => logout()}>Sign out</button></> : <Link className="button button-small" to="/login">Sign in</Link>}
      </nav>
    </header>
    <main>{children}</main>
    <footer><div className="brand">SEAT<span>SYNC</span></div><p>Cinema booking, perfectly in sync.</p><p>© {new Date().getFullYear()} SeatSync · Simulated payments only</p></footer>
  </div>;
}

export function PageLoader() { return <div className="page-state"><div className="loader" /><p>Preparing your experience…</p></div>; }
export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) { return <div className="page-state"><h2>That scene didn’t load</h2><p>{message}</p><button className="button" onClick={() => location.reload()}>Try again</button></div>; }
export function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty"><Clapperboard size={34}/><h3>{title}</h3><p>{text}</p></div>; }
export function formatDate(date: string) { return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)); }
export function formatTime(date: string) { return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(date)); }
export function peso(value: number) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value); }
