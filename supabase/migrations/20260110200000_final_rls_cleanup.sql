-- This migration performs a final cleanup of any overly permissive 
-- 'SELECT' policies that may have been missed by previous migrations.
-- The policy name being dropped was identified as the root cause of the RLS failure.

DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.tenants;
