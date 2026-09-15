-- Migration: Add SERVICE_CLIENT role to public.user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SERVICE_CLIENT';

-- Update user_roles check constraint if any exists
-- Ensure RLS policies allow SERVICE_CLIENT to read rooms, locations, and bookings

-- 1. Locations
DROP POLICY IF EXISTS "Locations viewable by authenticated users" ON public.locations;
CREATE POLICY "Locations viewable by authenticated users"
ON public.locations FOR SELECT
TO authenticated
USING (true);

-- 2. Rooms
DROP POLICY IF EXISTS "Rooms viewable by authenticated users" ON public.rooms;
CREATE POLICY "Rooms viewable by authenticated users"
ON public.rooms FOR SELECT
TO authenticated
USING (true);

-- 3. Bookings (read-only for planning)
DROP POLICY IF EXISTS "Bookings viewable by authenticated users" ON public.bookings;
CREATE POLICY "Bookings viewable by authenticated users"
ON public.bookings FOR SELECT
TO authenticated
USING (true);
