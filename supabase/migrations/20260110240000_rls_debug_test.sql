-- RLS Diagnostic Test: This policy should block all SELECT access to the bookings table for everyone except superusers.
-- The goal is to verify if RLS is being enforced at all.

-- 1. Drop all previous SELECT policies to ensure a clean slate.
DROP POLICY IF EXISTS "Allow access to bookings based on user location" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Bookings viewable by authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.bookings;

-- 2. Create a single, undeniable policy that returns FALSE for every row.
CREATE POLICY "TEST - SHOULD SEE NOTHING" ON public.bookings FOR SELECT USING (false);
