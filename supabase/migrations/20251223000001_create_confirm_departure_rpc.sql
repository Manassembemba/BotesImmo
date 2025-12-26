CREATE OR REPLACE FUNCTION public.confirm_departure_and_cleanup(p_booking_id UUID, p_room_id UUID, p_agent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    room_number TEXT;
BEGIN
    -- Start transaction (PL/pgSQL functions are implicitly transactional)

    -- 1. Update booking status
    UPDATE public.bookings
    SET
        status = 'COMPLETED',
        check_out_reel = NOW(),
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- Check if booking was found and updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking with ID % not found or not updated', p_booking_id;
    END IF;

    -- Get room number for task description before updating room status
    SELECT numero INTO room_number FROM public.rooms WHERE id = p_room_id;

    -- 2. Update room status to A_NETTOYER
    UPDATE public.rooms
    SET
        status = 'A_NETTOYER',
        updated_at = NOW()
    WHERE id = p_room_id;

    -- Check if room was found and updated
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
        p_agent_id, -- Agent who confirmed departure
        NOW()
    );

    -- End transaction (implicit commit)
END;
$$;

-- Grant usage and execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.confirm_departure_and_cleanup(UUID, UUID, UUID) TO authenticated;
