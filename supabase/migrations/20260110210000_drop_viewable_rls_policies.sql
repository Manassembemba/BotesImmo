-- This migration drops the specific, legacy RLS policies by their correct names,
-- which were identified from the Supabase dashboard. This should resolve
-- the final RLS conflict.

DROP POLICY IF EXISTS "Rooms viewable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Bookings viewable by authenticated users" ON public.bookings;
