CREATE OR REPLACE FUNCTION public.get_bookings_with_financials(
    p_search_term text DEFAULT NULL::text,
    p_status text[] DEFAULT NULL::text[],
    p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_offset integer DEFAULT 0,
    p_limit integer DEFAULT 15
)
RETURNS TABLE(
    id uuid,
    room_id uuid,
    tenant_id uuid,
    agent_id uuid,
    date_debut_prevue timestamp with time zone,
    date_fin_prevue timestamp with time zone,
    check_in_reel timestamp with time zone,
    check_out_reel timestamp with time zone,
    prix_total numeric,
    caution_encaissee numeric,
    notes text,
    status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    rooms jsonb,
    tenants jsonb,
    financial_summary jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.room_id,
    b.tenant_id,
    b.agent_id,
    b.date_debut_prevue::timestamptz,
    b.date_fin_prevue::timestamptz,
    b.check_in_reel::timestamptz,
    b.check_out_reel::timestamptz,
    b.prix_total::numeric,
    b.caution_encaissee::numeric,
    b.notes::text,
    b.status::text,
    b.created_at::timestamptz,
    b.updated_at::timestamptz,
    jsonb_build_object('numero', r.numero, 'type', r.type) as rooms,
    jsonb_build_object('nom', t.nom, 'prenom', t.prenom, 'email', t.email, 'telephone', t.telephone, 'id_document', t.id_document) as tenants,
    to_jsonb(fs.*) - 'booking_id' as financial_summary
  FROM bookings b
  JOIN rooms r ON b.room_id = r.id
  JOIN tenants t ON b.tenant_id = t.id
  LEFT JOIN booking_financial_summary fs ON b.id = fs.booking_id
  WHERE 
    -- SECURITY FILTERING
    (
      public.has_role('ADMIN'::public.user_role, auth.uid()) 
      OR 
      r.location_id = public.get_my_location_id()
    )
    -- USER FILTERS
    AND (p_search_term IS NULL OR 
     t.nom ILIKE '%' || p_search_term || '%' OR 
     t.prenom ILIKE '%' || p_search_term || '%' OR 
     r.numero ILIKE '%' || p_search_term || '%')
    AND (p_status IS NULL OR b.status::text = ANY(p_status))
    AND (p_start_date IS NULL OR b.date_debut_prevue < p_end_date)
    AND (p_end_date IS NULL OR b.date_fin_prevue > p_start_date)
  ORDER BY b.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$function$;
