-- Migration: Simplify check_booking_conflict signature for PostgREST compatibility
-- Date: 19 janvier 2026
-- Objectif: Supprimer le paramètre p_booking_id_to_exclude de la fonction check_booking_conflict pour voir si PostgREST a des problèmes avec les paramètres par défaut dans les RPC.

CREATE OR REPLACE FUNCTION public.check_booking_conflict(
    p_room_id uuid,
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_effective_start_date timestamptz;
  v_effective_end_date timestamptz;
BEGIN
  -- Adjust p_start_date to 13:00 (1 PM) of the day to allow for same-day turnover (standard checkout is 11:00 AM)
  v_effective_start_date := (p_start_date::date + interval '13 hours')::timestamptz;

  -- Adjust p_end_date to 11:00:00 AM of its day
  v_effective_end_date := (p_end_date::date + interval '11 hours')::timestamptz;

  RETURN EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE
      b.room_id = p_room_id
      AND b.status <> 'CANCELLED'
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
