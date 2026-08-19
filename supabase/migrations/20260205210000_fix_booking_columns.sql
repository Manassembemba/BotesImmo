-- Migration: Fix booking function columns
-- Date: 5 février 2026
-- Objectif: S'assurer que la colonne exchange_rate existe dans la table payments

-- S'assurer que la colonne exchange_rate existe
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 2) DEFAULT 2800.0;

-- Mettre à jour la contrainte pour utiliser la bonne colonne
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS check_montant_coherence;

ALTER TABLE public.payments
  ADD CONSTRAINT check_montant_coherence
  CHECK (
    ABS(montant - (montant_usd + montant_cdf / COALESCE(NULLIF(exchange_rate, 0), 2800.0))) < 1.00
  );