-- This migration forcefully disables and re-enables RLS on the bookings table,
-- then reapplies the correct location-scoped RLS policies.
-- This is a last-resort fix for persistent RLS enforcement issues.

-- 1. Disable RLS (if enabled)
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies on bookings to ensure a clean slate
DROP POLICY IF EXISTS "Allow access to bookings based on user location" ON public.bookings;
DROP POLICY IF EXISTS "TEST - SHOULD SEE NOTHING" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Bookings viewable by authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Admin and agents can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Bookings manageable by authenticated users" ON public.bookings;


-- 3. Enable RLS (forcefully)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 4. Re-create the correct location-scoped policy
CREATE POLICY "Allow access to bookings based on user location"
ON public.bookings
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = bookings.room_id) = public.get_my_location_id()
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = bookings.room_id) = public.get_my_location_id()
);
