-- ##################################################################
-- 1. HELPER FUNCTIONS
-- ##################################################################
-- Helper function to get the location_id of the currently authenticated user.
-- Returns NULL if the user has no location assigned (e.g., an admin).
CREATE OR REPLACE FUNCTION public.get_my_location_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT location_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Helper function to get the location_id of a specific user.
-- Returns NULL if the user has no location assigned (e.g., an admin).
CREATE OR REPLACE FUNCTION public.get_user_location_id(target_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT location_id FROM public.profiles WHERE user_id = target_user_id;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_location_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_location_id(UUID) TO authenticated;


-- ##################################################################
-- 2. ROOMS RLS POLICIES
-- ##################################################################
-- Make sure RLS is enabled on the table
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing, non-scoped policies on the rooms table
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Agents can update room status" ON public.rooms;
DROP POLICY IF EXISTS "Rooms manageable by admin and agents" ON public.rooms;
DROP POLICY IF EXISTS "Rooms updatable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Rooms deletable by admin" ON public.rooms;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.rooms;


-- Create a new set of policies that are location-aware.

-- POLICY: SELECT
-- Admins can see all rooms.
-- Agents can only see rooms belonging to their assigned location.
CREATE POLICY "Allow read access based on user location"
ON public.rooms
FOR SELECT
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = public.get_my_location_id()
);

-- POLICY: INSERT
-- Admins can insert rooms for any location.
-- Agents can only insert rooms for their own location.
CREATE POLICY "Allow insert based on user location"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = public.get_my_location_id()
);

-- POLICY: UPDATE
-- Admins can update any room.
-- Agents can only update rooms in their own location.
CREATE POLICY "Allow update based on user location"
ON public.rooms
FOR UPDATE
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = public.get_my_location_id()
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = public.get_my_location_id()
);

-- POLICY: DELETE
-- Only Admins can delete rooms.
CREATE POLICY "Allow admin to delete"
ON public.rooms
FOR DELETE
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
);

-- ##################################################################
-- 3. BOOKINGS RLS POLICIES
-- ##################################################################
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin and agents can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Bookings manageable by authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.bookings;

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


-- ##################################################################
-- 4. TENANTS RLS POLICIES
-- ##################################################################
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin and agents can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants manageable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Tenants updatable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Allow select access to authenticated users" ON public.tenants;

CREATE POLICY "Allow access to tenants based on user location"
ON public.tenants
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.rooms r ON b.room_id = r.id
    WHERE b.tenant_id = tenants.id
    AND r.location_id = public.get_my_location_id()
  )
);
