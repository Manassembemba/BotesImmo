-- Migration: Fix booking function with proper enum casting
-- Date: 5 février 2026
-- Objectif: Recréer la fonction create_booking_with_invoice_atomic avec le bon casting de type

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.create_booking_with_invoice_atomic(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, BOOLEAN, BOOLEAN);

-- Recréer la fonction avec le bon casting de type
CREATE OR REPLACE FUNCTION public.create_booking_with_invoice_atomic(
  p_room_id UUID,
  p_tenant_id UUID,
  p_agent_id UUID,
  p_date_debut_prevue TIMESTAMPTZ,
  p_date_fin_prevue TIMESTAMPTZ,
  p_prix_total NUMERIC,
  p_exchange_rate NUMERIC,
  p_caution_encaissee NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_discount_per_night NUMERIC DEFAULT 0,
  p_initial_payment_usd NUMERIC DEFAULT 0,
  p_initial_payment_cdf NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'CASH',
  p_is_immediate_checkin BOOLEAN DEFAULT FALSE,
  p_bypass_conflict BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id UUID;
  v_invoice_id UUID;
  v_payment_id UUID;
  v_room RECORD;
  v_tenant RECORD;
  v_nights INTEGER;
  v_gross_total NUMERIC;
  v_discount_total NUMERIC;
  v_net_total NUMERIC;
  v_total_payment_usd NUMERIC;
  v_invoice_number TEXT;
  v_invoice_status TEXT;
  v_has_conflict BOOLEAN;
  v_payment_method_enum public.payment_method;
BEGIN
  -- Validate and convert payment method to enum
  IF p_payment_method IS NULL OR p_payment_method = '' THEN
    v_payment_method_enum := 'CASH'::public.payment_method;
  ELSE
    BEGIN
      v_payment_method_enum := p_payment_method::public.payment_method;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Méthode de paiement invalide: %. Valeurs autorisées: CB, CASH, TRANSFERT, CHEQUE', p_payment_method;
    END;
  END IF;

  -- Validation des paramètres
  IF p_room_id IS NULL OR p_tenant_id IS NULL OR p_agent_id IS NULL THEN
    RAISE EXCEPTION 'room_id, tenant_id et agent_id sont requis';
  END IF;

  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'Un taux de change valide est requis.';
  END IF;

  IF p_date_fin_prevue <= p_date_debut_prevue THEN
    RAISE EXCEPTION 'La date de fin doit être après la date de début';
  END IF;

  -- Vérifier disponibilité de la chambre via la fonction unifiée
  v_has_conflict := public.check_booking_conflict(
    p_room_id,
    p_date_debut_prevue,
    p_date_fin_prevue
  );

  IF v_has_conflict AND NOT p_bypass_conflict THEN
    RAISE EXCEPTION 'Conflit de date détecté pour cette chambre.' USING ERRCODE = 'P0001';
  END IF;

  -- Récupérer les informations de la chambre et du locataire
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Chambre introuvable: %', p_room_id; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Locataire introuvable: %', p_tenant_id; END IF;

  -- Calculs de la facture
  v_nights := GREATEST(1, EXTRACT(DAY FROM (p_date_fin_prevue - p_date_debut_prevue)));
  v_gross_total := v_nights * v_room.prix_base_nuit;
  v_discount_total := v_nights * p_discount_per_night;
  v_net_total := v_gross_total - v_discount_total;

  -- Calcul du paiement total en USD (Source de vérité)
  v_total_payment_usd := p_initial_payment_usd + (p_initial_payment_cdf / p_exchange_rate);

  -- 1. CRÉER LA RÉSERVATION
  INSERT INTO public.bookings (
    room_id, tenant_id, agent_id, date_debut_prevue, date_fin_prevue, check_in_reel,
    prix_total, caution_encaissee, notes, status
  ) VALUES (
    p_room_id, p_tenant_id, p_agent_id, p_date_debut_prevue, p_date_fin_prevue,
    CASE WHEN p_is_immediate_checkin THEN NOW() ELSE NULL END,
    p_prix_total, p_caution_encaissee, p_notes,
    CASE WHEN p_is_immediate_checkin THEN 'IN_PROGRESS' ELSE 'CONFIRMED' END
  ) RETURNING id INTO v_booking_id;

  -- 2. METTRE À JOUR LE STATUT DE LA CHAMBRE
  IF p_is_immediate_checkin THEN
    UPDATE public.rooms SET status = 'Occupé' WHERE id = p_room_id;
  END IF;

  -- 3. CRÉER LA FACTURE
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

  IF v_total_payment_usd >= v_net_total THEN v_invoice_status := 'PAID';
  ELSIF v_total_payment_usd > 0 THEN v_invoice_status := 'PARTIALLY_PAID';
  ELSE v_invoice_status := 'ISSUED';
  END IF;

  INSERT INTO public.invoices (
    invoice_number, date, due_date, booking_id, tenant_id, status, items,
    subtotal, total, discount_amount, net_total, amount_paid, currency, notes,
    tenant_name, tenant_email, tenant_phone, room_number, room_type,
    booking_start_date, booking_end_date
  ) VALUES (
    v_invoice_number, NOW(), p_date_fin_prevue, v_booking_id, p_tenant_id, v_invoice_status,
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'id', gen_random_uuid(), 'description', 'Location ' || v_room.type || ' - ' || v_nights || ' nuits',
      'quantity', v_nights, 'unit_price', v_room.prix_base_nuit, 'total', v_gross_total
    )),
    v_gross_total, v_gross_total, v_discount_total, v_net_total, v_total_payment_usd, 'USD', 'Facture initiale',
    v_tenant.prenom || ' ' || v_tenant.nom, v_tenant.email, v_tenant.telephone, v_room.numero, v_room.type,
    p_date_debut_prevue, p_date_fin_prevue
  ) RETURNING id INTO v_invoice_id;

  -- 4. CRÉER LE PAIEMENT INITIAL
  IF v_total_payment_usd > 0 THEN
    INSERT INTO public.payments (
      booking_id, invoice_id, montant, methode, date_paiement, notes,
      montant_usd, montant_cdf, exchange_rate
    ) VALUES (
      v_booking_id, v_invoice_id, v_total_payment_usd, v_payment_method_enum, NOW(), 'Paiement initial',
      p_initial_payment_usd, p_initial_payment_cdf, p_exchange_rate
    ) RETURNING id INTO v_payment_id;
  END IF;

  RETURN JSON_BUILD_OBJECT(
    'success', TRUE, 'booking_id', v_booking_id, 'invoice_id', v_invoice_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de la réservation: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;