-- Assurez-vous que RLS est bien activé sur la table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Supprime l'ancienne politique si elle existe, pour éviter les conflits
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bookings;

-- Crée la nouvelle politique qui autorise la lecture à tous les utilisateurs connectés
CREATE POLICY "Enable read access for authenticated users"
ON public.bookings
FOR SELECT
TO authenticated
USING (true);
