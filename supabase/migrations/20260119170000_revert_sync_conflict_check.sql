-- Migration: Revert sync of conflict check logic for testing
-- Date: 19 janvier 2026
-- Objectif: Rétablir la version précédente de check_booking_conflict à la demande de l'utilisateur pour des tests.

CREATE OR REPLACE FUNCTION public.check_booking_conflict(
    p_room_id uuid,
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_booking_id_to_exclude uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_effective_start_date timestamptz;
  v_effective_end_date timestamptz;
BEGIN
  -- This is the old, likely buggy, logic being restored for testing.
  v_effective_start_date := (p_start_date::date + interval '13 hours')::timestamptz;
  v_effective_end_date := (p_end_date::date + interval '11 hours')::timestamptz;

  RETURN EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE
      b.room_id = p_room_id
      AND b.status <> 'CANCELLED'
      AND b.id IS DISTINCT FROM p_booking_id_to_exclude
      AND b.date_debut_prevue < v_effective_end_date
      AND (
        CASE 
            WHEN b.status = 'COMPLETED' AND b.check_out_reel IS NOT NULL THEN b.check_out_reel 
            ELSE b.date_fin_prevue 
        END
      ) > v_effective_start_date
  );
END;
$function$;
