import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components';
import { useAuth } from './auth';
import { HomePage, MoviesPage, MoviePage, AboutPage } from './pages/movies';
import { AuthPage } from './pages/auth-page';
import { SeatsPage, CheckoutPage, TicketPage } from './pages/booking';
import { ProfilePage } from './pages/profile';
import { AdminPage } from './pages/admin';

function Protected({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/movies" element={<MoviesPage />} />
    <Route path="/movies/:slug" element={<MoviePage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/showtimes/:id/seats" element={<SeatsPage />} />
    <Route path="/checkout/:reservationId" element={<Protected><CheckoutPage /></Protected>} />
    <Route path="/tickets/:reference" element={<Protected><TicketPage /></Protected>} />
    <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="/admin" element={<Protected admin><AdminPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes></Layout>;
}
