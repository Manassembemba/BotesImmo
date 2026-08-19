CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.user_id
  WHERE p.username = lower(trim(p_username));

  RETURN v_email;
END;
$$;

-- Grant execution to the anon role so it can be called by unauthenticated users from the login page.
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO authenticated;
