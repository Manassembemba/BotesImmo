-- Create the locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    adresse_ligne1 TEXT NOT NULL,
    adresse_ligne2 TEXT,
    ville TEXT NOT NULL,
    province TEXT,
    pays TEXT NOT NULL,
    code_postal TEXT,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.locations IS 'Stores information about different property locations or complexes.';
COMMENT ON COLUMN public.locations.nom IS 'The name of the location, e.g., "Complexe Oasis".';

-- Enable Row Level Security
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create a basic read policy for authenticated users
CREATE POLICY "Allow read access to authenticated users"
ON public.locations
FOR SELECT
USING (auth.role() = 'authenticated');

-- Set up the trigger for automatically updating the updated_at timestamp
-- Assumes the handle_updated_at function already exists from previous migrations.
CREATE TRIGGER on_locations_updated
BEFORE UPDATE ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
