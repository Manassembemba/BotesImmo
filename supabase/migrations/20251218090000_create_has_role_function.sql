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
