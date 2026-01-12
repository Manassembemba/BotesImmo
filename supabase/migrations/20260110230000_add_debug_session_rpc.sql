create or replace function public.debug_my_session()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'is_admin', public.has_role('ADMIN', auth.uid()),
    'location_id', public.get_my_location_id()
  );
$$;

grant execute on function public.debug_my_session() to authenticated;
