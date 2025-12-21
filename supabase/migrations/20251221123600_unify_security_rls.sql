-- ##################################################################
-- UNIFICATION DE LA FONCTION HAS_ROLE
-- ##################################################################

CREATE OR REPLACE FUNCTION public.has_role(
  _role public.user_role,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = _user_id
    AND user_roles.role = _role
  );
END;
$$;

-- ##################################################################
-- NETTOYAGE ET SÉCURISATION DES POLITIQUES RLS
-- ##################################################################

-- 1. SETTINGS
DROP POLICY IF EXISTS "Settings manageable by admin" ON public.settings;
CREATE POLICY "Settings manageable by admin"
ON public.settings FOR ALL
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

-- 2. LOCATIONS
DROP POLICY IF EXISTS "Allow full access to admins on locations" ON public.locations;
CREATE POLICY "Admins can manage locations"
ON public.locations FOR ALL
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

CREATE POLICY "Agents can view locations"
ON public.locations FOR SELECT
TO authenticated
USING (true);

-- 3. SEASONAL PRICES
ALTER TABLE public.seasonal_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage seasonal prices" ON public.seasonal_prices;
CREATE POLICY "Admins can manage seasonal prices"
ON public.seasonal_prices FOR ALL
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

CREATE POLICY "Agents can view seasonal prices"
ON public.seasonal_prices FOR SELECT
TO authenticated
USING (true);

-- 4. ROOMS
DROP POLICY IF EXISTS "Rooms manageable by admin and agents" ON public.rooms;
DROP POLICY IF EXISTS "Rooms updatable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Rooms deletable by admin" ON public.rooms;

CREATE POLICY "Admins can manage rooms"
ON public.rooms FOR ALL
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

CREATE POLICY "Agents can update room status"
ON public.rooms FOR UPDATE
TO authenticated
USING (public.has_role('AGENT_RES', auth.uid()) OR public.has_role('AGENT_OP', auth.uid()));

-- 5. TENANTS
DROP POLICY IF EXISTS "Tenants manageable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Tenants updatable by authenticated users" ON public.tenants;

CREATE POLICY "Admin and agents can manage tenants"
ON public.tenants FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid()) OR 
  public.has_role('AGENT_RES', auth.uid()) OR 
  public.has_role('AGENT_OP', auth.uid())
);

-- 6. BOOKINGS
DROP POLICY IF EXISTS "Bookings manageable by authenticated users" ON public.bookings;
CREATE POLICY "Admin and agents can manage bookings"
ON public.bookings FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid()) OR 
  public.has_role('AGENT_RES', auth.uid()) OR 
  public.has_role('AGENT_OP', auth.uid())
);

-- 7. TASKS
DROP POLICY IF EXISTS "Tasks manageable by authenticated users" ON public.tasks;
CREATE POLICY "Admin and op agents can manage tasks"
ON public.tasks FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid()) OR 
  public.has_role('AGENT_OP', auth.uid())
);

CREATE POLICY "Res agents can view tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (public.has_role('AGENT_RES', auth.uid()));

-- 8. INCIDENTS
DROP POLICY IF EXISTS "Incidents manageable by authenticated users" ON public.incidents;
CREATE POLICY "Admin and agents can manage incidents"
ON public.incidents FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid()) OR 
  public.has_role('AGENT_RES', auth.uid()) OR 
  public.has_role('AGENT_OP', auth.uid())
);

-- 9. INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoices viewable by authenticated users" ON public.invoices;
CREATE POLICY "Invoices viewable by authenticated users"
ON public.invoices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and agents can manage invoices"
ON public.invoices FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid()) OR 
  public.has_role('AGENT_RES', auth.uid())
);

-- 10. PROFILES
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role('ADMIN', auth.uid()));
