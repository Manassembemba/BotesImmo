-- Migration: Drop obsolete RPC overloads causing PGRST203 ambiguity errors

-- 1. Drop old 7-param update_booking_with_invoice_atomic overload
DROP FUNCTION IF EXISTS public.update_booking_with_invoice_atomic(
    uuid, 
    timestamp with time zone, 
    timestamp with time zone, 
    numeric, 
    text, 
    text, 
    boolean
);

-- 2. Drop old 4-param extend_stay_atomic overload
DROP FUNCTION IF EXISTS public.extend_stay_atomic(
    uuid, 
    timestamp with time zone, 
    numeric, 
    numeric
);

-- 3. Drop old 6-param create_booking_and_checkin overload
DROP FUNCTION IF EXISTS public.create_booking_and_checkin(
    uuid, 
    uuid, 
    uuid, 
    real, 
    real, 
    text
);

-- 4. Drop old 4-param get_conflicting_booking overload
DROP FUNCTION IF EXISTS public.get_conflicting_booking(
    uuid, 
    timestamp with time zone, 
    timestamp with time zone, 
    uuid
);
