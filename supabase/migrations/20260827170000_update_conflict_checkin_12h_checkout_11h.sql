-- Migration: Align check_booking_conflict and get_conflicting_booking with 12:00 Check-in / 11:00 Check-out

CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_room_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_booking_id_to_exclude uuid DEFAULT NULL::uuid,
  p_is_immediate_checkin boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_request_start timestamptz;
  v_request_end   timestamptz;
BEGIN
  -- 1. Normaliser les timestamps de la nouvelle demande
  IF p_is_immediate_checkin THEN
    v_request_start := NOW();
  ELSE
    -- Check-in standard : 12h00 UTC le jour d'arrivée
    v_request_start := (p_start_date::date + interval '12 hours') AT TIME ZONE 'UTC';
  END IF;

  -- Check-out standard : 11h00 UTC le jour de départ
  v_request_end := (p_end_date::date + interval '11 hours') AT TIME ZONE 'UTC';

  -- 2. Vérifier le chevauchement avec les réservations ACTIVES
  RETURN EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE
      b.room_id = p_room_id
      AND b.id IS DISTINCT FROM p_booking_id_to_exclude
      AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
      AND (
        (b.date_debut_prevue::date + interval '12 hours') AT TIME ZONE 'UTC' < v_request_end
        AND
        (b.date_fin_prevue::date + interval '11 hours') AT TIME ZONE 'UTC' > v_request_start
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_conflicting_booking(
  p_room_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_booking_id_to_exclude uuid DEFAULT NULL::uuid,
  p_is_immediate_checkin boolean DEFAULT false
)
RETURNS TABLE(id uuid, tenant_name text, date_debut_prevue timestamp with time zone, date_fin_prevue timestamp with time zone, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_request_start timestamptz;
  v_request_end   timestamptz;
BEGIN
  IF p_is_immediate_checkin THEN
    v_request_start := NOW();
  ELSE
    v_request_start := (p_start_date::date + interval '12 hours') AT TIME ZONE 'UTC';
  END IF;

  v_request_end := (p_end_date::date + interval '11 hours') AT TIME ZONE 'UTC';

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
      AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
      AND (
        (b.date_debut_prevue::date + interval '12 hours') AT TIME ZONE 'UTC' < v_request_end
        AND
        (b.date_fin_prevue::date + interval '11 hours') AT TIME ZONE 'UTC' > v_request_start
      )
    LIMIT 1;
END;
$function$;
