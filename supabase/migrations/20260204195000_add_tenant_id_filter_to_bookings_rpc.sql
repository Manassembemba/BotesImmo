-- Migration: Add tenant_id filter to get_bookings_with_financials
-- Description: Updates the RPC to allow filtering bookings by a specific tenant.

-- Drop old versions (with different signatures if any)
DROP FUNCTION IF EXISTS public.get_bookings_with_financials(text, text[], timestamp with time zone, timestamp with time zone, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_bookings_with_financials(
  p_search_term text DEFAULT NULL::text,
  p_status text[] DEFAULT NULL::text[],
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10,
  p_location_id uuid DEFAULT NULL::uuid,
  p_tenant_id uuid DEFAULT NULL::uuid -- NEW PARAMETER
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
  room_number text,
  room_type text,
  location_id uuid,
  location_name text,
  tenant_nom text,
  tenant_prenom text,
  tenant_email text,
  tenant_telephone text,
  agent_email text,
  total_factures numeric,
  total_paiements numeric,
  reste_a_payer numeric,
  statut_paiement text,
  total_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_location_id uuid;
  v_is_admin boolean;
BEGIN
  -- Check if user is ADMIN
  v_is_admin := public.has_role('ADMIN'::public.user_role, auth.uid());
  
  -- Get user's assigned location (if any)
  v_user_location_id := public.get_my_location_id();

  RETURN QUERY
  WITH filtered_bookings AS (
    SELECT 
      b.id,
      b.room_id,
      b.tenant_id,
      b.agent_id,
      b.date_debut_prevue,
      b.date_fin_prevue,
      b.check_in_reel,
      b.check_out_reel,
      b.prix_total,
      b.caution_encaissee,
      b.notes,
      b.status::text,
      b.created_at,
      b.updated_at,
      r.numero::text as room_number,
      r.type::text as room_type,
      r.location_id as room_location_id,
      l.nom::text as location_name,
      t.nom::text as tenant_nom,
      t.prenom::text as tenant_prenom,
      t.email::text as tenant_email,
      t.telephone::text as tenant_telephone,
      au.email::text as agent_email,
      COALESCE(bfs.total_invoiced, 0) as total_factures,
      COALESCE(bfs.total_paid, 0) as total_paiements,
      COALESCE(bfs.balance_due, 0) as reste_a_payer,
      bfs.payment_summary_status::text as statut_paiement,
      count(*) OVER() as full_count
    FROM public.bookings b
    JOIN public.rooms r ON b.room_id = r.id
    LEFT JOIN public.locations l ON r.location_id = l.id
    JOIN public.tenants t ON b.tenant_id = t.id
    LEFT JOIN auth.users au ON b.agent_id = au.id
    LEFT JOIN public.booking_financial_summary bfs ON b.id = bfs.booking_id
    WHERE 
      -- SECURITY & FILTERING LOGIC (Parentheses added for correct precedence)
      (
        (v_is_admin AND (p_location_id IS NULL OR r.location_id = p_location_id))
        OR 
        (NOT v_is_admin AND r.location_id = v_user_location_id)
      )
      -- SEARCH FILTERS (Now applied correctly to both conditions above)
      AND (p_search_term IS NULL OR 
           t.nom ILIKE '%' || p_search_term || '%' OR 
           t.prenom ILIKE '%' || p_search_term || '%' OR 
           r.numero ILIKE '%' || p_search_term || '%')
      AND (p_status IS NULL OR b.status::text = ANY(p_status))
      -- Date filtering corrected: Allow partial filters (only start or only end)
      AND (p_end_date IS NULL OR b.date_debut_prevue <= p_end_date)
      AND (p_start_date IS NULL OR b.date_fin_prevue >= p_start_date)
      AND (p_tenant_id IS NULL OR b.tenant_id = p_tenant_id) -- NEW FILTER
  )
  SELECT 
    fb.id,
    fb.room_id,
    fb.tenant_id,
    fb.agent_id,
    fb.date_debut_prevue,
    fb.date_fin_prevue,
    fb.check_in_reel,
    fb.check_out_reel,
    fb.prix_total,
    fb.caution_encaissee,
    fb.notes,
    fb.status,
    fb.created_at,
    fb.updated_at,
    fb.room_number,
    fb.room_type,
    fb.room_location_id,
    fb.location_name,
    fb.tenant_nom,
    fb.tenant_prenom,
    fb.tenant_email,
    fb.tenant_telephone,
    fb.agent_email,
    fb.total_factures,
    fb.total_paiements,
    fb.reste_a_payer,
    fb.statut_paiement,
    fb.full_count
  FROM filtered_bookings fb
  ORDER BY fb.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;
