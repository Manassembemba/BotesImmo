-- Migration: Robust Invoice Access Control
-- Date: 2026-01-12
-- Description: Introduces a SECURITY DEFINER function to safely check invoice access without RLS recursion.

-- 1. Create the helper function with elevated privileges
CREATE OR REPLACE FUNCTION public.can_access_invoice(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_location_id uuid;
  v_invoice_location_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;


  -- 2. Check if user is ADMIN (Direct table check to avoid signature confusion)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_user_id 
    AND role = 'ADMIN'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  -- 3. Get user's location
  SELECT location_id INTO v_user_location_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  -- If user has no location and is not admin, deny access
  IF v_user_location_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 4. Get invoice's location via booking -> room
  SELECT r.location_id INTO v_invoice_location_id
  FROM public.bookings b
  JOIN public.rooms r ON b.room_id = r.id
  WHERE b.id = p_booking_id;

  -- 5. Compare locations
  RETURN v_invoice_location_id = v_user_location_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.can_access_invoice(uuid) TO authenticated;


-- 2. Apply this function to the invoices RLS policy
-- First, drop the existing policy to be clean
DROP POLICY IF EXISTS "Allow access to invoices based on user location" ON public.invoices;

-- Recreate it using the secure function
CREATE POLICY "Allow access to invoices based on user location"
ON public.invoices
FOR ALL
TO authenticated
USING (public.can_access_invoice(booking_id))
WITH CHECK (public.can_access_invoice(booking_id));
