-- This migration applies location-scoped RLS policies to the remaining relevant tables.

-- ##################################################################
-- 1. INVOICES RLS POLICIES
-- ##################################################################
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Invoices viewable by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Admin and agents can manage invoices" ON public.invoices;

-- Create new location-scoped policy
CREATE POLICY "Allow access to invoices based on user location"
ON public.invoices
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT r.location_id FROM public.bookings b JOIN public.rooms r ON b.room_id = r.id WHERE b.id = invoices.booking_id) = public.get_my_location_id()
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT r.location_id FROM public.bookings b JOIN public.rooms r ON b.room_id = r.id WHERE b.id = invoices.booking_id) = public.get_my_location_id()
);


-- ##################################################################
-- 2. TASKS RLS POLICIES
-- ##################################################################
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Tasks manageable by authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Admin and op agents can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Res agents can view tasks" ON public.tasks;


-- Create new location-scoped policy
CREATE POLICY "Allow access to tasks based on user location"
ON public.tasks
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = tasks.room_id) = public.get_my_location_id()
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = tasks.room_id) = public.get_my_location_id()
);


-- ##################################################################
-- 3. INCIDENTS RLS POLICIES
-- ##################################################################
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Incidents manageable by authenticated users" ON public.incidents;
DROP POLICY IF EXISTS "Admin and agents can manage incidents" ON public.incidents;


-- Create new location-scoped policy
CREATE POLICY "Allow access to incidents based on user location"
ON public.incidents
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = incidents.room_id) = public.get_my_location_id()
)
WITH CHECK (
  public.has_role('ADMIN', auth.uid())
  OR
  (SELECT location_id FROM public.rooms WHERE id = incidents.room_id) = public.get_my_location_id()
);
