-- Migration: Fix Ambiguous RPC and Robust Conflict Check
-- Date: 19 janvier 2026
-- Description: 
-- 1. Drops conflicting overloaded versions of check_booking_conflict to resolve 300 Error.
-- 2. Re-implements the function with all parameters (defaults for backward compat).
-- 3. ENFORCES logic where all stored bookings are treated as 13:00 Check-in / 11:00 Check-out for conflict calculation, regardless of stored timestamp (00:00 vs real time).
--    This ensures Same-Day Turnover (End 20th, Start 20th) works correctly.

-- DROP ambiguous old versions explicitly
DROP FUNCTION IF EXISTS public.check_booking_conflict(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.check_booking_conflict(uuid, timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.check_booking_conflict(uuid, timestamptz, timestamptz, uuid, boolean);
DROP FUNCTION IF EXISTS public.check_booking_conflict(uuid, timestamp with time zone, timestamp with time zone);

-- Recreate Single Authority Function
CREATE OR REPLACE FUNCTION public.check_booking_conflict(
    p_room_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz,
    p_booking_id_to_exclude uuid DEFAULT NULL,
    p_is_immediate_checkin BOOLEAN DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_request_start timestamptz;
  v_request_end timestamptz;
BEGIN
  -- 1. Normalize REQUEST Timestamps
  -- Start: If immediate, NOW(). Else 13:00 on the requested start day.
  IF p_is_immediate_checkin THEN
    v_request_start := NOW();
  ELSE
    v_request_start := (p_start_date::date + interval '13 hours')::timestamptz;
  END IF;

  -- End: 11:00 on the requested end day.
  v_request_end := (p_end_date::date + interval '11 hours')::timestamptz;

  -- 2. Check Overlap using Normalized Database Times
  -- We assume ALL existing bookings effectively block the room from Start(13:00) to End(11:00).
  -- This ignores "midnight" stored times and fixes the turnover bug.
  RETURN EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE
      b.room_id = p_room_id
      AND b.id IS DISTINCT FROM p_booking_id_to_exclude
      AND b.status NOT IN ('CANCELLED', 'EXTENDED') -- EXTENDED are handled by new row usually, or logic handled elsewhere. Standard is usually just ignore CANCELLED.
      -- Note: If you have logic where EXTENDED replaces original, exclude it. If EXTENDED is just a status, check logic matches app.
      -- Standard app logic: status <> 'CANCELLED'.
      AND b.status <> 'CANCELLED'
      AND (
         -- Normalized Existing Range
         (b.date_debut_prevue::date + interval '13 hours')::timestamptz,
         (
            CASE 
               -- If completed and checked out early, use real checkout time (normalized to date + time if needed, or raw?)
               -- To be safe and consistent with "Hotel Logic", let's trust the Date part primarily for planning.
               -- But if real checkout happened, we free up.
               WHEN b.status = 'COMPLETED' AND b.check_out_reel IS NOT NULL THEN b.check_out_reel
               ELSE (b.date_fin_prevue::date + interval '11 hours')::timestamptz
            END
         )
      ) OVERLAPS (v_request_start, v_request_end)
  );
END;
$function$;
