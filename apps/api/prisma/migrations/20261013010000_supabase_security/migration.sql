-- SeatSync uses its Express API as the only public data-access layer.
-- Enabling RLS without public policies denies Supabase anon/authenticated Data API
-- roles while the dedicated Prisma role (BYPASSRLS) continues to serve the API.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Movie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Auditorium" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Seat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Showtime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShowtimeSeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
