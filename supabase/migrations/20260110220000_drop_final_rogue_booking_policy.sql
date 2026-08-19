-- This migration drops the specific, legacy RLS policies by their correct names,
-- which were identified from the Supabase dashboard.
-- This should resolve the final RLS conflict.

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.rooms;
