-- This migration applies location-scoped RLS policies to the payments table.

-- ##################################################################
-- 1. PAYMENTS RLS POLICIES
-- ##################################################################
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;


-- Create new location-scoped policy
-- A user can see a payment if they have access to the booking associated with it.
-- The booking policy is already location-scoped.
CREATE POLICY "Allow access to payments based on user location"
ON public.payments
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  (
    booking_id IN (SELECT id FROM public.bookings)
  )
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  (
    booking_id IN (SELECT id FROM public.bookings)
  )
);
