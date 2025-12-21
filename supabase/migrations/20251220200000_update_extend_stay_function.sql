create or replace function extend_stay(
    p_booking_id uuid,
    p_new_date_fin_prevue timestamptz,
    p_new_prix_total real
)
returns bookings
language plpgsql
as $$
declare
    v_booking bookings;
begin
    -- Update the booking with the new end date and total price
    update public.bookings
    set
        date_fin_prevue = p_new_date_fin_prevue,
        prix_total = p_new_prix_total,
        -- Reset status to CONFIRMED, as the stay is ongoing
        status = 'CONFIRMED'
    where id = p_booking_id
    returning * into v_booking;

    -- Return the updated booking
    return v_booking;
end;
$$;
