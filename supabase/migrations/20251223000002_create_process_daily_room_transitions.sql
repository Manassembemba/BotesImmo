CREATE OR REPLACE FUNCTION public.process_daily_room_transitions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_current_time TIMESTAMPTZ := NOW();
BEGIN
    -- Transition #1: OCCUPE -> A_NETTOYER (for unattended checkouts at 11:00 AM)
    -- Find bookings where planned_check_out_date (date part) is today and it's past 11:00 AM
    -- and the booking is still active (OCCUPIED or CONFIRMED for example)
    -- and the room is currently OCCUPE
    FOR r IN
        SELECT
            b.id AS booking_id,
            b.room_id,
            r.numero AS room_numero,
            b.agent_id -- We need an agent_id to create the task, if not available, we use a default admin ID or null
        FROM
            public.bookings b
        JOIN
            public.rooms r ON b.room_id = r.id
        WHERE
            b.check_out_reel IS NULL -- Not checked out yet
            AND b.date_fin_prevue::date = v_current_time::date -- Planned check-out date is today
            AND b.date_fin_prevue + INTERVAL '11 hours' <= v_current_time -- It's 11:00 AM or later
            AND r.status = 'OCCUPE' -- Room is currently occupied
    LOOP
        RAISE NOTICE 'Processing unattended checkout for Booking ID: %, Room ID: %', r.booking_id, r.room_id;

        -- Update booking status to COMPLETED and set check_out_reel
        UPDATE public.bookings
        SET
            status = 'COMPLETED',
            check_out_reel = v_current_time,
            updated_at = v_current_time
        WHERE id = r.booking_id;

        -- Update room status to A_NETTOYER
        UPDATE public.rooms
        SET
            status = 'A_NETTOYER',
            updated_at = v_current_time
        WHERE id = r.room_id;

        -- Create cleaning task
        INSERT INTO public.tasks (room_id, type_tache, description, status_tache, assigned_to_user_id, date_creation)
        VALUES (
            r.room_id,
            'NETTOYAGE',
            'Nettoyage après départ automatique - Chambre ' || r.room_numero,
            'TO_DO',
            r.agent_id, -- Use the agent who created the booking, or a system/admin ID
            v_current_time
        );
    END LOOP;

    -- Transition #2: A_NETTOYER -> LIBRE (after 1 hour cleaning time, i.e., 12:00 PM or later)
    -- This assumes check_out_reel is set by either explicit checkout or the unattended checkout above.
    FOR r IN
        SELECT
            r.id AS room_id,
            b.check_out_reel
        FROM
            public.rooms r
        JOIN
            public.bookings b ON r.id = b.room_id
        WHERE
            r.status = 'A_NETTOYER'
            AND b.check_out_reel IS NOT NULL
            AND b.check_out_reel + INTERVAL '1 hour' <= v_current_time -- 1 hour after actual checkout
            AND b.status = 'COMPLETED' -- Ensure booking is completed
    LOOP
        RAISE NOTICE 'Transitioning Room ID: % from A_NETTOYER to LIBRE', r.room_id;

        UPDATE public.rooms
        SET
            status = 'LIBRE',
            updated_at = v_current_time
        WHERE id = r.room_id;
    END LOOP;

    -- Optional: Clean up old PENDING_CHECKOUT booking statuses if they somehow still exist
    -- UPDATE public.bookings SET status = 'COMPLETED' WHERE status = 'PENDING_CHECKOUT';

END;
$$;

-- Grant usage and execute permissions
GRANT EXECUTE ON FUNCTION public.process_daily_room_transitions() TO authenticated;
