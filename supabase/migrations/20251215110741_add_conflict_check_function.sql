-- Function to check for booking conflicts for a given room and date range
-- Returns TRUE if a conflict exists, FALSE otherwise.

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
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE 
      room_id = p_room_id
      AND status <> 'CANCELLED'
      AND id IS DISTINCT FROM p_booking_id_to_exclude
      AND (date_debut_prevue, date_fin_prevue) OVERLAPS (p_start_date, p_end_date)
  );
END;
$$;

COMMENT ON FUNCTION public.check_booking_conflict IS 'Checks for overlapping bookings for a specific room and date range, optionally excluding a specific booking ID (for updates). Returns true if a conflict is found.';
