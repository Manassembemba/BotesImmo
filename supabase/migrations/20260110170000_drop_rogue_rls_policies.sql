-- This migration drops the final conflicting RLS policies that were
-- granting overly permissive SELECT access to non-admin users.

DROP POLICY IF EXISTS "Rooms viewable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Bookings viewable by authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Tenants viewable by authenticated users" ON public.tenants;
