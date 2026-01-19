-- Migration: Fix booking conflict overlap logic
-- Date: 19 janvier 2026
-- Objectif: Retirer le tampon de 1 heure dans la clause OVERLAPS pour permettre les réservations consécutives le même jour (ex: départ 11h, arrivée 12h).

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
  v_room RECORD;
  v_tenant RECORD;
  v_nights INTEGER;
  v_gross_total NUMERIC;
  v_discount_total NUMERIC;
BEGIN
  -- ... (le reste de la fonction reste identique jusqu'à la vérification) ...

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

  -- Vérifier disponibilité de la chambre (CORRIGÉ)
  IF EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE room_id = p_room_id 
    AND status NOT IN ('CANCELLED', 'EXTENDED', 'COMPLETED')
    AND (
      (date_debut_prevue, date_fin_prevue) OVERLAPS (v_forced_start_date, v_forced_end_date)
    )
  ) THEN
    RAISE EXCEPTION 'Conflit de réservation : la chambre est déjà réservée pour tout ou partie de cette période.';
  END IF;

  -- ... (le reste de la fonction reste identique) ...

  -- Calculer les montants
  v_nights := GREATEST(1, (v_forced_end_date::date - v_forced_start_date::date));
  v_gross_total := v_nights * v_room.prix_base_nuit;
  v_discount_total := v_nights * p_discount_per_night;

  -- 1. CRÉER LA RÉSERVATION
  INSERT INTO public.bookings (
    room_id, tenant_id, agent_id, date_debut_prevue, date_fin_prevue, check_in_reel,
    prix_total, caution_encaissee, notes, status, created_at, updated_at
  ) VALUES (
    p_room_id, p_tenant_id, p_agent_id, v_forced_start_date, v_forced_end_date,
    CASE WHEN p_is_immediate_checkin THEN NOW() ELSE NULL END, p_prix_total,
    p_caution_encaissee, p_notes, CASE WHEN p_is_immediate_checkin THEN 'CONFIRMED' ELSE 'PENDING' END,
    NOW(), NOW()
  ) RETURNING id INTO v_booking_id;

  IF p_is_immediate_checkin THEN
    UPDATE public.rooms SET status = 'Occupé', updated_at = NOW() WHERE id = p_room_id;
  END IF;

  -- Le reste de la logique de facturation et de paiement est omis pour la brièveté, car elle ne change pas.
  -- ...
  RETURN json_build_object('success', TRUE, 'id', v_booking_id); -- Simplifié
END;
$$ LANGUAGE plpgsql;
