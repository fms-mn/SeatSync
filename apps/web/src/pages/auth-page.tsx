import { useState, type FormEvent } from 'react';
import { Clapperboard } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function AuthPage() {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/profile" replace/>;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'login') await login({ email: String(form.get('email')), password: String(form.get('password')) });
      else await register({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) });
      navigate('/profile');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to continue'); } finally { setBusy(false); }
  };
  return <div className="auth-page"><section className="auth-story"><Clapperboard/><p className="eyebrow accent">Your next story starts here</p><blockquote>“The cinema should make you forget you are sitting in a theater.”</blockquote><p>— Roman Polanski</p></section><section className="auth-panel"><form onSubmit={submit} className="auth-form"><p className="eyebrow">Welcome to SeatSync</p><h1>{mode === 'login' ? 'Good to see you.' : 'Create your account.'}</h1><p>{mode === 'login' ? 'Sign in to manage your tickets and reservations.' : 'Join for faster checkout and a complete booking history.'}</p>
    {mode === 'register' && <label>Full name<input name="name" autoComplete="name" minLength={2} required placeholder="Alex Rivera"/></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="alex@example.com"/></label>
    <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters"/></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button button-wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
    <p className="switch-auth">{mode === 'login' ? 'New to SeatSync?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
  </form></section></div>;
}
