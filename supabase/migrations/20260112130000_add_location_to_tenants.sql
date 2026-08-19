DO $$
BEGIN
  -- Vérifier si la colonne location_id existe déjà dans la table tenants
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND column_name = 'location_id'
  ) THEN
    -- Ajouter la colonne location_id à la table tenants
    ALTER TABLE public.tenants
    ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
    
    -- Ajouter un commentaire pour clarifier l'utilisation de la colonne
    COMMENT ON COLUMN public.tenants.location_id IS 'The location associated with this tenant. Used for multi-location filtering.';
  END IF;
END $$;

-- Enable Row Level Security on the tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenants selectable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Tenants updatable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Tenants insertable by authenticated users" ON public.tenants;
DROP POLICY IF EXISTS "Tenants deletable by authenticated users" ON public.tenants;

-- Policy: Allow admins to see all tenants
CREATE POLICY "Allow admin to see all tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

-- Policy: Allow non-admins to see tenants linked to their location
CREATE POLICY "Allow users to see tenants for their location"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = (
    SELECT location_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Allow admins to manage tenants
CREATE POLICY "Allow admin to manage tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

-- Policy: Allow non-admins to manage tenants linked to their location
CREATE POLICY "Allow users to manage tenants for their location"
ON public.tenants
FOR ALL
TO authenticated
USING (
  public.has_role('ADMIN', auth.uid())
  OR
  location_id = (
    SELECT location_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);