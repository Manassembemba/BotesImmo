CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_room_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_booking_id_to_exclude uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_effective_start_date timestamptz;
  v_effective_end_date timestamptz;
BEGIN
  -- Adjust p_start_date to the beginning of the day (00:00:00)
  v_effective_start_date := p_start_date::date::timestamptz;

  -- Adjust p_end_date to 11:00:00 AM of its day
  v_effective_end_date := (p_end_date::date + interval '11 hours')::timestamptz;

  RETURN EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE
      room_id = p_room_id
      AND status <> 'CANCELLED'
      AND id IS DISTINCT FROM p_booking_id_to_exclude
      AND (date_debut_prevue, date_fin_prevue) OVERLAPS (v_effective_start_date, v_effective_end_date)
  );
END;
$$;
