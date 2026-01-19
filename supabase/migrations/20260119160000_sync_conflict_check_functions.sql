-- Migration: Synchronize conflict check logic
-- Date: 19 janvier 2026
-- Objectif: Rendre la fonction check_booking_conflict parfaitement cohérente avec create_booking_with_invoice_atomic

CREATE OR REPLACE FUNCTION public.check_booking_conflict(
    p_room_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz,
    p_booking_id_to_exclude uuid DEFAULT NULL,
    p_is_immediate_checkin BOOLEAN DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_effective_start_date timestamptz;
  v_effective_end_date timestamptz;
BEGIN
  -- Logique de date/heure exactement comme dans la fonction de création
  v_effective_end_date := (p_end_date::date + interval '11 hours')::timestamptz;

  IF p_is_immediate_checkin THEN
    v_effective_start_date := NOW();
  ELSE
    v_effective_start_date := (p_start_date::date + interval '12 hours')::timestamptz;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE
      room_id = p_room_id
      AND id IS DISTINCT FROM p_booking_id_to_exclude
      AND status NOT IN ('CANCELLED', 'EXTENDED', 'COMPLETED')
      AND (date_debut_prevue, date_fin_prevue) OVERLAPS (v_effective_start_date, v_effective_end_date)
  );
END;
$function$;
