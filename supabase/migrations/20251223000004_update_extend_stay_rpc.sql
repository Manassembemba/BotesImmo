create or replace function public.extend_stay(
    p_booking_id uuid,
    p_new_date_fin_prevue timestamptz, -- Still accepts timestamptz, but time part will be overridden
    p_new_prix_total real
)
returns public.bookings
language plpgsql
as $$
declare
    v_booking public.bookings;
    v_forced_new_end_date timestamptz;
begin
    -- Force the new end date time to 11:00:00 AM
    -- Assuming p_new_date_fin_prevue provides the correct *date*
    v_forced_new_end_date := (p_new_date_fin_prevue::date + interval '11 hours')::timestamptz;

    -- Update the booking with the new end date and total price
    update public.bookings
    set
        date_fin_prevue = v_forced_new_end_date, -- Use the forced 11 AM new end date
        prix_total = p_new_prix_total,
        -- Reset status to CONFIRMED, as the stay is ongoing
        status = 'CONFIRMED'
    where id = p_booking_id
    returning * into v_booking;

    -- Return the updated booking
    return v_booking;
end;
$$;
