-- Add report access password to settings table
-- This migration adds a password protection for the reports page

-- Insert the report access password setting
INSERT INTO public.settings (key, value) 
VALUES ('report_access_password', '"2026"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create a secure function to verify the report password
CREATE OR REPLACE FUNCTION public.check_report_password(input_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_password TEXT;
BEGIN
  -- Retrieve the password from settings
  SELECT value::text INTO stored_password
  FROM public.settings
  WHERE key = 'report_access_password';
  
  -- Remove quotes from jsonb string value
  stored_password := TRIM(BOTH '"' FROM stored_password);
  
  -- Compare passwords
  RETURN stored_password = input_password;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_report_password(TEXT) TO authenticated;

COMMENT ON FUNCTION public.check_report_password IS 'Securely verifies the report access password without exposing it to the client';
