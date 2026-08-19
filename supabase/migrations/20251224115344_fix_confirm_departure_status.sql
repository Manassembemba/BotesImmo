-- Force re-apply by adding a comment
CREATE OR REPLACE FUNCTION public.confirm_departure_and_cleanup(p_booking_id UUID, p_room_id UUID, p_agent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    room_number TEXT;
BEGIN
    -- 1. Update booking status to COMPLETED
    UPDATE public.bookings
    SET
        status = 'COMPLETED',
        check_out_reel = NOW(),
        updated_at = NOW()
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking with ID % not found or not updated', p_booking_id;
    END IF;

    -- Get room number for task description
    SELECT numero INTO room_number FROM public.rooms WHERE id = p_room_id;

    -- 2. Update room status to 'Nettoyage'
    UPDATE public.rooms
    SET
        status = 'Nettoyage', -- CORRECTED VALUE
        updated_at = NOW()
    WHERE id = p_room_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room with ID % not found or not updated', p_room_id;
    END IF;

    -- 3. Create cleaning task
    INSERT INTO public.tasks (room_id, type_tache, description, status_tache, assigned_to_user_id, date_creation)
    VALUES (
        p_room_id,
        'NETTOYAGE',
        'Nettoyage après départ - Chambre ' || room_number,
        'TO_DO',
        p_agent_id,
        NOW()
    );
END;
$$;
