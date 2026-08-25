-- Migration: Fix sync_room_statuses priority for occupied rooms
-- Date: 2026-08-25
-- Description: Garantit que les chambres ayant une réservation active (IN_PROGRESS ou CONFIRMED couvrant la date courante) sont marquées en 'Occupé' et ne sont pas écrasées par de vieilles réservations passées.

CREATE OR REPLACE FUNCTION public.sync_room_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_current_time TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Lubumbashi';
BEGIN
    -- 1. CAS: Chambres OCCUPÉES (Réservation en cours active)
    WITH mark_occupied AS (
        UPDATE public.rooms r
        SET 
            status = 'Occupé'::room_status,
            updated_at = v_current_time
        WHERE EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.room_id = r.id
            AND b.status IN ('IN_PROGRESS', 'CONFIRMED')
            AND (
                (b.check_in_reel IS NOT NULL AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time))
                OR (v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue AND b.check_out_reel IS NULL)
            )
        )
        AND r.status IS DISTINCT FROM 'Occupé'::room_status
        RETURNING 1
    )
    SELECT count(*) + v_updated_count INTO v_updated_count FROM mark_occupied;

    -- 2. CAS: Chambres RÉSERVÉES (Arrivée aujourd'hui, pas encore check-in)
    WITH mark_booked AS (
        UPDATE public.rooms r
        SET 
            status = 'BOOKED'::room_status,
            updated_at = v_current_time
        WHERE EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'PENDING')
            AND b.date_debut_prevue::date = v_current_time::date
            AND v_current_time < b.date_debut_prevue
            AND b.check_in_reel IS NULL
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.bookings b2
            WHERE b2.room_id = r.id
            AND b2.status = 'IN_PROGRESS'
            AND (b2.check_out_reel IS NULL OR b2.check_out_reel > v_current_time)
        )
        AND r.status NOT IN ('Occupé'::room_status, 'BOOKED'::room_status, 'Maintenance'::room_status)
        RETURNING 1
    )
    SELECT count(*) + v_updated_count INTO v_updated_count FROM mark_booked;

    -- 3. CAS: Chambres LIBRES (Aucune réservation active, pas en maintenance, pas à nettoyer)
    WITH mark_free AS (
        UPDATE public.rooms r
        SET 
            status = 'Libre'::room_status,
            updated_at = v_current_time
        WHERE r.status NOT IN ('Maintenance'::room_status, 'A_NETTOYER'::room_status, 'Nettoyage'::room_status)
        AND NOT EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.room_id = r.id
            AND b.status IN ('IN_PROGRESS', 'CONFIRMED', 'PENDING')
            AND (
                (b.status = 'IN_PROGRESS' AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time))
                OR (v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue AND b.check_out_reel IS NULL)
                OR (b.date_debut_prevue::date = v_current_time::date AND b.check_in_reel IS NULL)
            )
        )
        AND r.status IS DISTINCT FROM 'Libre'::room_status
        RETURNING 1
    )
    SELECT count(*) + v_updated_count INTO v_updated_count FROM mark_free;

    RETURN v_updated_count;
END;
$$;
