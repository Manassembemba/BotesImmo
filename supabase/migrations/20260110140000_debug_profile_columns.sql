CREATE OR REPLACE FUNCTION public.debug_get_profile_columns()
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_agg(column_name::text)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles';
$$;

GRANT EXECUTE ON FUNCTION public.debug_get_profile_columns() TO authenticated;
