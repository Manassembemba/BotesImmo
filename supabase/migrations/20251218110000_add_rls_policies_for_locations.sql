-- This policy allows users with the 'ADMIN' role to perform any action
-- on the 'locations' table. The `has_role` function was created in a 
-- previous migration.

CREATE POLICY "Allow full access to admins on locations"
ON public.locations
FOR ALL
USING (public.has_role('ADMIN', auth.uid()))
WITH CHECK (public.has_role('ADMIN', auth.uid()));
