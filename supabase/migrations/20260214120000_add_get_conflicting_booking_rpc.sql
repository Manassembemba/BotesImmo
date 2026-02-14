-- Fonction pour récupérer les détails de la réservation en conflit
CREATE OR REPLACE FUNCTION public.get_conflicting_booking(
    p_room_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz,
    p_booking_id_to_exclude uuid DEFAULT NULL,
    p_is_immediate_checkin BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id uuid,
    tenant_name text,
    date_debut_prevue timestamptz,
    date_fin_prevue timestamptz,
    status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_request_start timestamptz;
  v_request_end timestamptz;
BEGIN
  -- 1. Normalize REQUEST Timestamps (Même logique que check_booking_conflict)
  IF p_is_immediate_checkin THEN
    v_request_start := NOW();
  ELSE
    v_request_start := (p_start_date::date + interval '13 hours')::timestamptz;
  END IF;

  v_request_end := (p_end_date::date + interval '11 hours')::timestamptz;

  RETURN QUERY
    SELECT 
        b.id,
        (t.prenom || ' ' || t.nom)::text as tenant_name,
        b.date_debut_prevue,
        b.date_fin_prevue,
        b.status::text
    FROM public.bookings b
    LEFT JOIN public.tenants t ON b.tenant_id = t.id
    WHERE
      b.room_id = p_room_id
      AND b.id IS DISTINCT FROM p_booking_id_to_exclude
      AND b.status <> 'CANCELLED'
      AND (
         (b.date_debut_prevue::date + interval '13 hours')::timestamptz,
         (
            CASE 
               WHEN b.status = 'COMPLETED' AND b.check_out_reel IS NOT NULL THEN b.check_out_reel
               ELSE (b.date_fin_prevue::date + interval '11 hours')::timestamptz
            END
         )
      ) OVERLAPS (v_request_start, v_request_end)
    LIMIT 1;
END;
$$;
