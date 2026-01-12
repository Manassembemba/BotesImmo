-- This migration fixes an issue where old, permissive RLS policies were not being
-- dropped, causing security policies to not be enforced correctly for non-admin users.

-- Drop conflicting policies on rooms
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.rooms;

-- Drop conflicting policies on bookings
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.bookings;

-- Drop conflicting policies on tenants
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.tenants;
