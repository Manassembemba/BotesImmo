-- 1. Add invoice_id column to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);

-- 2. Add amount_paid and balance_due columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Assuming net_total exists. If not, this might need adjustment to use 'total'.
-- The generated column will automatically compute the balance due.
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10, 2) GENERATED ALWAYS AS (COALESCE(net_total, total) - amount_paid) STORED;

-- 3. Add 'PARTIALLY_PAID' to the allowed statuses for an invoice
-- To do this, we must drop the old constraint and create a new one.
-- This assumes the constraint is named 'invoices_status_check' as per the previous error message.
ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'PARTIALLY_PAID'));

-- Note: This migration does not backfill data. Existing invoices will have amount_paid = 0
-- and their status will not be automatically updated. A separate script would be needed for that.
COMMENT ON COLUMN public.invoices.balance_due IS 'Automatically calculated as net_total - amount_paid';
