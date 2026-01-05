-- Migration: Suppression atomique des réservations
-- Date: 2 janvier 2026

CREATE OR REPLACE FUNCTION public.delete_booking_with_invoice_atomic(
  p_booking_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Annuler la facture (ou la supprimer si possible)
  IF EXISTS (SELECT 1 FROM public.payments WHERE booking_id = p_booking_id) THEN
    UPDATE public.invoices SET status = 'CANCELLED', updated_at = now() WHERE booking_id = p_booking_id;
  ELSE
    DELETE FROM public.invoices WHERE booking_id = p_booking_id;
  END IF;

  -- 2. Supprimer la réservation
  DELETE FROM public.bookings WHERE id = p_booking_id;

  RETURN JSON_BUILD_OBJECT('success', TRUE);
END;
$$;
