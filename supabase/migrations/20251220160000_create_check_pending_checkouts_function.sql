create or replace function public.check_pending_checkouts()
returns integer -- Returns the number of bookings updated
language plpgsql
as $$
declare
    updated_count integer;
begin
    with updated_rows as (
        update public.bookings
        set status = 'PENDING_CHECKOUT'
        where
            status = 'CONFIRMED'
            and check_out_reel is null
            and date_fin_prevue < now()
        returning id
    )
    select count(*) into updated_count from updated_rows;

    return updated_count;
end;
$$;
