-- Migration: Final update to sync_room_statuses
-- Date: 23 mai 2026
-- Description:
-- 1. Dès 00:01 le jour d'une réservation, la chambre passe à 'BOOKED' (RÉSERVÉ).
-- 2. Dès 12:00 (heure du check-in), la chambre passe à 'Occupé'.
-- 3. Auto-clôture des réservations terminées depuis plus de 24h (passage à 'COMPLETED').
-- 4. Gère les transitions automatiques avec timezone Lubumbashi.

CREATE OR REPLACE FUNCTION public.sync_room_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_booking_updated_count INTEGER := 0;
    v_rows_affected INTEGER;
    v_current_time TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Lubumbashi';
    v_checkout_hour INTEGER := 11;
    v_checkin_hour INTEGER := 12;
BEGIN
    -- Récupérer les paramètres de configuration si disponibles, sinon utiliser les défauts
    SELECT 
        COALESCE((setting_value->>'hour')::INTEGER, 11)
    INTO v_checkout_hour
    FROM public.room_sync_settings
    WHERE setting_key = 'checkout_time'
    LIMIT 1;

    -- ========================================================================
    -- AUTO-CLÔTURE DES RÉSERVATIONS PASSÉES (Nettoyage du calendrier)
    -- ========================================================================
    WITH updates_to_completed AS (
        UPDATE public.bookings
        SET 
            status = 'COMPLETED',
            updated_at = v_current_time
        WHERE 
            status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
            AND date_fin_prevue < (v_current_time - INTERVAL '24 hours')
        RETURNING 1
    )
    SELECT count(*) INTO v_booking_updated_count FROM updates_to_completed;

    -- ========================================================================
    -- 1. CAS: Libre/Nettoyage -> BOOKED (Arrivée prévue AUJOURD'HUI)
    -- ========================================================================
    WITH updates_to_booked AS (
        UPDATE public.rooms r
        SET
            status = 'BOOKED',
            updated_at = v_current_time
        WHERE
            r.status IN ('Libre', 'Nettoyage', 'A_NETTOYER')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'PENDING')
                AND b.date_debut_prevue::date = v_current_time::date
                AND v_current_time::time < MAKE_TIME(v_checkin_hour, 0, 0)
                AND b.check_in_reel IS NULL
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_booked;
    v_updated_count := v_updated_count + v_rows_affected;

    -- ========================================================================
    -- 2. CAS: BOOKED/Libre -> Occupé (Heure de check-in 12h ATTEINTE)
    -- ========================================================================
    WITH updates_to_occupied AS (
        UPDATE public.rooms r
        SET
            status = 'Occupé',
            updated_at = v_current_time
        WHERE
            r.status IN ('BOOKED', 'Libre', 'Nettoyage', 'A_NETTOYER')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'PENDING', 'IN_PROGRESS')
                AND (
                    (b.date_debut_prevue::date = v_current_time::date AND v_current_time::time >= MAKE_TIME(v_checkin_hour, 0, 0))
                    OR (v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue)
                )
                AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_occupied;
    v_updated_count := v_updated_count + v_rows_affected;

    -- ========================================================================
    -- 3. CAS: Occupé -> PENDING_CHECKOUT (2h avant 11h ou la fin prévue)
    -- ========================================================================
    WITH updates_to_pending_checkout AS (
        UPDATE public.rooms r
        SET
            status = 'PENDING_CHECKOUT',
            updated_at = v_current_time
        WHERE
            r.status = 'Occupé'
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
                AND (
                    v_current_time >= (b.date_fin_prevue - INTERVAL '2 hours')
                    OR (b.date_fin_prevue::date = v_current_time::date AND v_current_time::time >= MAKE_TIME(v_checkout_hour - 2, 0, 0))
                )
                AND v_current_time < b.date_fin_prevue
                AND b.check_out_reel IS NULL
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_pending_checkout;
    v_updated_count := v_updated_count + v_rows_affected;

    -- ========================================================================
    -- 4. CAS: Occupé/PENDING_CHECKOUT -> A_NETTOYER (Check-out 11h DÉPASSÉ)
    -- ========================================================================
    WITH updates_to_cleaning AS (
        UPDATE public.rooms r
        SET
            status = 'A_NETTOYER',
            updated_at = v_current_time
        WHERE
            r.status IN ('Occupé', 'PENDING_CHECKOUT')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT', 'COMPLETED')
                AND (
                    (v_current_time::date >= b.date_fin_prevue::date AND v_current_time::time >= MAKE_TIME(v_checkout_hour, 0, 0))
                    OR v_current_time > b.date_fin_prevue
                )
                AND b.check_out_reel IS NULL
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_cleaning;
    v_updated_count := v_updated_count + v_rows_affected;

    -- ========================================================================
    -- 5. CAS: Sécurité - Retour à 'Libre' si aucune réservation active
    -- ========================================================================
    WITH updates_to_free_security AS (
        UPDATE public.rooms r
        SET
            status = 'Libre',
            updated_at = v_current_time
        WHERE
            r.status IN ('Occupé', 'BOOKED', 'PENDING_CHECKOUT')
            AND NOT EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'PENDING', 'IN_PROGRESS', 'PENDING_CHECKOUT')
                AND (
                    v_current_time::date = b.date_debut_prevue::date
                    OR (v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue)
                )
                AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free_security;
    v_updated_count := v_updated_count + v_rows_affected;

    -- Logging global
    IF (v_updated_count + v_booking_updated_count) > 0 THEN
        PERFORM public.log_room_status_transition(
            NULL,
            'SYSTEM',
            'AUTO_SYNC',
            'CRON',
            NULL,
            NULL,
            format('Synchronisation automatique effectuée : %s chambres et %s réservations mises à jour', v_updated_count, v_booking_updated_count)
        );
    END IF;

    RETURN v_updated_count + v_booking_updated_count;
END;
$$;
