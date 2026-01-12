ALTER TABLE public.profiles
ADD COLUMN username TEXT;

-- Add a unique constraint to the username column
-- Using a separate step allows existing rows to be populated before enforcing uniqueness.
-- It's also good practice to make constraints deferrable if needed, though not required here.
ALTER TABLE public.profiles
ADD CONSTRAINT username_unique UNIQUE (username);

-- Ensure usernames are consistently formatted (lowercase, no extra spaces)
-- This is a good practice to avoid login issues due to case sensitivity.
CREATE OR REPLACE FUNCTION public.lowercase_and_trim_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username = lower(trim(NEW.username));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all inserts and updates on the profiles table.
CREATE TRIGGER on_profile_username_insert_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.lowercase_and_trim_username();

COMMENT ON COLUMN public.profiles.username IS 'Unique, lowercase, trimmed username for login.';
