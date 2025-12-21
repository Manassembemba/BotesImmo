-- Function to check and update rooms that should be PENDING_CHECKOUT
CREATE OR REPLACE FUNCTION public.check_pending_checkouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update rooms to PENDING_CHECKOUT where:
  -- 1. Room is currently OCCUPIED
  -- 2. There's a booking with status CONFIRMED and check_in done
  -- 3. The planned end date (date_fin_prevue) has passed
  UPDATE public.rooms r
  SET status = 'PENDING_CHECKOUT', updated_at = now()
  WHERE r.status = 'OCCUPIED'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.room_id = r.id
        AND b.status = 'CONFIRMED'
        AND b.check_in_reel IS NOT NULL
        AND b.check_out_reel IS NULL
        AND b.date_fin_prevue <= now()
    );
END;
$$;

-- Create a cron-like function that can be called periodically
-- This will be triggered by a scheduled edge function
COMMENT ON FUNCTION public.check_pending_checkouts IS 'Automatically transitions OCCUPIED rooms to PENDING_CHECKOUT when checkout date is reached';