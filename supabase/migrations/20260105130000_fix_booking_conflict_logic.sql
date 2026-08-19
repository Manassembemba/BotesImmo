-- Migration: Correction de la détection de conflit pour permettre le check-in le jour du départ
-- Date: 2026-01-05
-- Description: Ajuste l'heure de début de la vérification à 13h00 (au lieu de 00h00) pour ne pas conflicter avec les check-outs standards à 11h00.
-- De plus, pour les réservations COMPLETED, on utilise la date de check-out réelle si elle est disponible pour libérer la chambre plus tôt.

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
