-- Migration: Correction des status dans process_daily_room_transitions
-- Date: 2026-01-05
-- Description: Met à jour la fonction pour utiliser les valeurs correctes de l'enum room_status : 'Occupé', 'Nettoyage', 'Libre'.

CREATE OR REPLACE FUNCTION public.process_daily_room_transitions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_current_time TIMESTAMPTZ := NOW();
BEGIN
    -- Transition #1: Occupé -> Nettoyage (for unattended checkouts at 11:00 AM)
    FOR r IN
        SELECT
            b.id AS booking_id,
            b.room_id,
            r.numero AS room_numero,
            b.agent_id
        FROM
            public.bookings b
        JOIN
            public.rooms r ON b.room_id = r.id
        WHERE
            b.check_out_reel IS NULL -- Not checked out yet
            AND b.date_fin_prevue::date = v_current_time::date -- Planned check-out date is today
            AND b.date_fin_prevue + INTERVAL '11 hours' <= v_current_time -- It's 11:00 AM or later
            AND r.status = 'Occupé' -- Room is currently occupied
    LOOP
        RAISE NOTICE 'Processing unattended checkout for Booking ID: %, Room ID: %', r.booking_id, r.room_id;

        -- Update booking status to COMPLETED and set check_out_reel
        UPDATE public.bookings
        SET
            status = 'COMPLETED',
            check_out_reel = v_current_time,
            updated_at = v_current_time
        WHERE id = r.booking_id;

        -- Update room status to Nettoyage
        UPDATE public.rooms
        SET
            status = 'Nettoyage',
            updated_at = v_current_time
        WHERE id = r.room_id;

        -- Create cleaning task
        INSERT INTO public.tasks (room_id, type_tache, description, status_tache, assigned_to_user_id, date_creation)
        VALUES (
            r.room_id,
            'NETTOYAGE',
            'Nettoyage après départ automatique - Chambre ' || r.room_numero,
            'TO_DO',
            r.agent_id,
            v_current_time
        );
    END LOOP;

    -- Transition #2: Nettoyage -> Libre (after 1 hour cleaning time)
    FOR r IN
        SELECT
            r.id AS room_id,
            b.check_out_reel
        FROM
            public.rooms r
        JOIN
            public.bookings b ON r.id = b.room_id
        WHERE
            r.status = 'Nettoyage'
            AND b.check_out_reel IS NOT NULL
            AND b.check_out_reel + INTERVAL '1 hour' <= v_current_time 
            AND b.status = 'COMPLETED'
    LOOP
        RAISE NOTICE 'Transitioning Room ID: % from Nettoyage to Libre', r.room_id;

        UPDATE public.rooms
        SET
            status = 'Libre',
            updated_at = v_current_time
        WHERE id = r.room_id;
    END LOOP;

END;
$$;
