create or replace function public.create_booking_and_checkin(
    p_room_id uuid,
    p_tenant_id uuid,
    p_agent_id uuid,
    p_prix_total real,
    p_caution_encaissee real,
    p_notes text,
    p_date_fin_prevue timestamptz
)
returns public.bookings
language plpgsql
as $$
declare
    v_checkin_time timestamptz := now();
    v_start_date timestamptz := v_checkin_time;
    v_room_status public.room_status;
    v_forced_end_date timestamptz;
    new_booking public.bookings;
begin
    v_forced_end_date := (p_date_fin_prevue::date + interval '11 hours')::timestamptz;

    -- 1. Check if room is available
    select status into v_room_status from public.rooms where id = p_room_id for update;
    if v_room_status != 'Libre' then -- CORRECTED
        raise exception 'La chambre % n''est pas Libre', p_room_id;
    end if;

    -- 2. Create the booking
    insert into public.bookings (
        room_id,
        tenant_id,
        agent_id,
        date_debut_prevue,
        date_fin_prevue,
        check_in_reel,
        prix_total,
        caution_encaissee,
        notes,
        status
    ) values (
        p_room_id,
        p_tenant_id,
        p_agent_id,
        v_start_date,
        v_forced_end_date,
        v_checkin_time,
        p_prix_total,
        p_caution_encaissee,
        p_notes,
        'CONFIRMED'
    ) returning * into new_booking;

    -- 3. Update the room status
    update public.rooms
    set status = 'Occupé' -- CORRECTED
    where id = p_room_id;

    -- 4. Return the created booking
    return new_booking;
end;
$$;
