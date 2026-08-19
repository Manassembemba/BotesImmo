-- Migration: Vue de résumé financier pour les réservations
-- Date: 2 janvier 2026

CREATE OR REPLACE VIEW public.booking_financial_summary AS
WITH invoice_totals AS (
    -- Somme de toutes les factures liées à la réservation (y compris extensions)
    SELECT 
        booking_id,
        SUM(net_total) as total_invoiced_usd
    FROM public.invoices
    WHERE status != 'CANCELLED'
    GROUP BY booking_id
),
payment_totals AS (
    -- Somme de tous les paiements enregistrés pour cette réservation
    SELECT 
        booking_id,
        SUM(montant) as total_paid_usd
    FROM public.payments
    GROUP BY booking_id
)
SELECT 
    b.id as booking_id,
    COALESCE(i.total_invoiced_usd, 0) as total_invoiced,
    COALESCE(p.total_paid_usd, 0) as total_paid,
    (COALESCE(i.total_invoiced_usd, 0) - COALESCE(p.total_paid_usd, 0)) as balance_due,
    CASE 
        WHEN (COALESCE(i.total_invoiced_usd, 0) - COALESCE(p.total_paid_usd, 0)) <= 0 THEN 'PAID'
        WHEN COALESCE(p.total_paid_usd, 0) > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
    END as payment_summary_status
FROM public.bookings b
LEFT JOIN invoice_totals i ON b.id = i.booking_id
LEFT JOIN payment_totals p ON b.id = p.booking_id;

-- Donner les accès
GRANT SELECT ON public.booking_financial_summary TO authenticated;
GRANT SELECT ON public.booking_financial_summary TO service_role;
