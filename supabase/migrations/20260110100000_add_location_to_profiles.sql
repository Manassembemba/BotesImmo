-- Add location_id to profiles table to link users to a specific location
ALTER TABLE public.profiles
ADD COLUMN location_id UUID;

-- Add a foreign key constraint to ensure data integrity
ALTER TABLE public.profiles
ADD CONSTRAINT fk_location
FOREIGN KEY (location_id)
REFERENCES public.locations(id)
ON DELETE SET NULL; -- If a location is deleted, set the user's location_id to NULL

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.location_id IS 'The location a user is assigned to. Controls data visibility for non-admin roles.';
