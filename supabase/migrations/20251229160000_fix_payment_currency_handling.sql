-- Migration: Fix exchange rate consistency
-- Date: 29 décembre 2025
-- Objectif: Utiliser le taux défini en paramètres et l'enregistrer dans chaque paiement

-- 1. Ajouter la colonne taux_change à la table payments
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS taux_change DECIMAL(10, 2) DEFAULT 2800;

-- 2. Mettre à jour la contrainte de cohérence pour utiliser cette colonne au lieu d'une valeur fixe
ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS check_montant_coherence;

ALTER TABLE public.payments
  ADD CONSTRAINT check_montant_coherence
  CHECK (
    ABS(montant - (montant_usd + montant_cdf / COALESCE(NULLIF(taux_change, 0), 2800.0))) < 1.00
  );

-- 3. Mettre à jour la fonction create_booking_with_invoice_atomic pour utiliser le taux dynamique
-- Note: On supprime d'abord l'ancienne version car le type de retour change (UUID -> JSON)
DROP FUNCTION IF EXISTS public.create_booking_with_invoice_atomic(uuid,numeric,timestamptz,timestamptz,numeric,numeric,numeric,numeric,boolean,text,text,numeric,uuid,uuid);
DROP FUNCTION IF EXISTS public.create_booking_with_invoice_atomic(uuid,uuid,uuid,timestamptz,timestamptz,numeric,numeric,text,numeric,numeric,numeric,public.payment_method,boolean);

CREATE OR REPLACE FUNCTION public.create_booking_with_invoice_atomic(
  p_agent_id UUID,
  p_caution_encaissee NUMERIC DEFAULT 0,
  p_date_debut_prevue TIMESTAMPTZ DEFAULT NOW(),
  p_date_fin_prevue TIMESTAMPTZ DEFAULT (NOW() + interval '1 day'),
  p_discount_per_night NUMERIC DEFAULT 0,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_initial_payment_cdf NUMERIC DEFAULT 0,
  p_initial_payment_usd NUMERIC DEFAULT 0,
  p_is_immediate_checkin BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'CASH',
  p_prix_total NUMERIC DEFAULT 0,
  p_room_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
) 
RETURNS JSON 
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id UUID;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_invoice_status TEXT;
  v_forced_end_date TIMESTAMPTZ;
  v_forced_start_date TIMESTAMPTZ;
  v_final_usd NUMERIC;
  v_final_cdf NUMERIC;
  v_final_amount NUMERIC;
  v_current_rate NUMERIC;
BEGIN
  -- 0. RÉCUPÉRER LE TAUX DE CHANGE (Priorité au paramètre p_exchange_rate)
  IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
    v_current_rate := p_exchange_rate;
  ELSE
    SELECT (value->>'usd_to_cdf')::NUMERIC INTO v_current_rate
    FROM public.settings
    WHERE key = 'exchange_rate';
    
    -- Fallback si non défini
    IF v_current_rate IS NULL OR v_current_rate <= 0 THEN
      v_current_rate := 2800.0;
    END IF;
  END IF;

  -- Forcer l'heure de fin à 11h00 pour la cohérence
  v_forced_end_date := (p_date_fin_prevue::date + interval '11 hours')::timestamptz;
  
  -- Forcer l'heure de début à 12h00 pour les réservations futures (Walk-ins exclus)
  IF p_is_immediate_checkin THEN
    v_forced_start_date := p_date_debut_prevue;
  ELSE
    v_forced_start_date := (p_date_debut_prevue::date + interval '12 hours')::timestamptz;
  END IF;

  IF v_forced_end_date <= v_forced_start_date THEN
    RAISE EXCEPTION 'La date de fin doit être après la date de début';
  END IF;
END;
$$;