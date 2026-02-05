-- Migration: Rename taux_change column to exchange_rate for consistency
-- Date: 5 février 2026
-- Objectif: Align column name with what the atomic booking function expects

-- 1. Check if the exchange_rate column already exists (in case of partial migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payments' AND column_name = 'taux_change')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payments' AND column_name = 'exchange_rate') THEN
    -- Column is already renamed, nothing to do
    RAISE NOTICE 'Column exchange_rate already exists, skipping rename';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'payments' AND column_name = 'taux_change') THEN
    -- Column needs to be renamed
    ALTER TABLE public.payments
      RENAME COLUMN taux_change TO exchange_rate;

    -- Update the constraint to use the new column name
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS check_montant_coherence;

    ALTER TABLE public.payments
      ADD CONSTRAINT check_montant_coherence
      CHECK (
        ABS(montant - (montant_usd + montant_cdf / COALESCE(NULLIF(exchange_rate, 0), 2800.0))) < 1.00
      );

    -- Update any indexes that might reference the old column name
    DROP INDEX IF EXISTS idx_payments_taux_change;
    CREATE INDEX IF NOT EXISTS idx_payments_exchange_rate
      ON public.payments(exchange_rate)
      WHERE exchange_rate > 0;

    -- Update comments if they exist
    COMMENT ON COLUMN public.payments.exchange_rate IS 'Taux de change utilisé pour la conversion CDF/USD au moment du paiement';
  ELSE
    -- Neither column exists, add the exchange_rate column
    ALTER TABLE public.payments
      ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 2) DEFAULT 2800.0;

    -- Update the constraint to use the new column name
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS check_montant_coherence;

    ALTER TABLE public.payments
      ADD CONSTRAINT check_montant_coherence
      CHECK (
        ABS(montant - (montant_usd + montant_cdf / COALESCE(NULLIF(exchange_rate, 0), 2800.0))) < 1.00
      );

    -- Create index for the new column
    CREATE INDEX IF NOT EXISTS idx_payments_exchange_rate
      ON public.payments(exchange_rate)
      WHERE exchange_rate > 0;

    -- Update comments if they exist
    COMMENT ON COLUMN public.payments.exchange_rate IS 'Taux de change utilisé pour la conversion CDF/USD au moment du paiement';
  END IF;
END $$;