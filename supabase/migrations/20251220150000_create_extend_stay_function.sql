create or replace function extend_stay(p_booking_id uuid)
returns bookings
language plpgsql
as $$
declare
    v_booking bookings;
    v_room rooms;
    v_new_date_fin_prevue timestamptz;
    v_new_prix_total real;
begin
    -- 1. Get the current booking and room info, and lock the row
    select * into v_booking from public.bookings where id = p_booking_id for update;
    select * into v_room from public.rooms where id = v_booking.room_id;

    if v_booking is null then
        raise exception 'Booking % not found', p_booking_id;
    end if;

    -- 2. Calculate new end date and price
    v_new_date_fin_prevue := v_booking.date_fin_prevue + interval '1 day';
    v_new_prix_total := v_booking.prix_total + v_room.prix_base_nuit;

    -- 3. Update the booking
    update public.bookings
    set
        date_fin_prevue = v_new_date_fin_prevue,
        prix_total = v_new_prix_total,
        -- Reset status to CONFIRMED, as the stay is ongoing
        status = 'CONFIRMED'
    where id = p_booking_id
    returning * into v_booking;

    -- 4. Return the updated booking
    return v_booking;
end;
$$;
