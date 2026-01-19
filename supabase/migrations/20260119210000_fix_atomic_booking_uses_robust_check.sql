-- Migration: Fix Atomic Booking to use Robust Conflict Check
-- Date: 19 janvier 2026
-- Objectif: Remplacer la logique de conflit 'hardcodée' dans la fonction atomique par l'appel à la fonction 'check_booking_conflict' qui gère correctement les turnovers le même jour.

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
  -- 1. Exchange Rate logic
  IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN v_current_rate := p_exchange_rate;
  ELSE
    SELECT (value->>'usd_to_cdf')::NUMERIC INTO v_current_rate FROM public.settings WHERE key = 'exchange_rate';
    IF v_current_rate IS NULL OR v_current_rate <= 0 THEN v_current_rate := 2800.0; END IF;
  END IF;

  -- 2. Validate Inputs
  IF p_room_id IS NULL OR p_tenant_id IS NULL OR p_agent_id IS NULL THEN RAISE EXCEPTION 'p_room_id, p_tenant_id et p_agent_id sont requis'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Chambre introuvable: %', p_room_id; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Locataire introuvable: %', p_tenant_id; END IF;
  
  -- 3. Calculate Forced Dates (for consistency, though check_booking_conflict handles its own normalization)
  -- We pass the RAW requested dates to check_booking_conflict, but since we are constructing the booking here,
  -- we should respect the logic.
  -- Legacy logic used: 12h for start if not immediate. 11h for end.
  
  v_forced_end_date := (p_date_fin_prevue::date + interval '11 hours')::timestamptz;
  
  IF p_is_immediate_checkin THEN 
    v_forced_start_date := NOW();
  ELSE 
    -- Keep alignment with 13h check-in (standard) or keep 12h?
    -- The robust check uses 13h. Let's use 13h here too to be safe and consistent, 
    -- OR rely on check_booking_conflict logic.
    -- If we insert 12h here, but check 13h, it's fine (12h < 13h).
    -- But let's stick to the previous implementation for insertion (12h) to avoid breaking expectations,
    -- or better yet, use 13h to be perfectly "Standard".
    -- Let's use 13h to match the Robust Check exactly.
    v_forced_start_date := (p_date_debut_prevue::date + interval '13 hours')::timestamptz;
  END IF;

  IF v_forced_end_date <= v_forced_start_date THEN RAISE EXCEPTION 'La date de fin doit être après la date de début'; END IF;

  -- 4. ROBUST CONFLICT CHECK (Replaces embedded naive loop)
  -- We pass the raw dates (or calculated ones) to the check function.
  -- The check function expects timestamps.
  IF public.check_booking_conflict(
    p_room_id, 
    v_forced_start_date, -- Pass the formatted start
    v_forced_end_date,   -- Pass the formatted end
    NULL,                -- No exclusion
    p_is_immediate_checkin
  ) THEN
    RAISE EXCEPTION 'Conflit de réservation : la chambre est déjà réservée pour tout ou partie de cette période.';
  END IF;

  -- 5. Calculate Financials
  v_nights := GREATEST(1, (v_forced_end_date::date - v_forced_start_date::date));
  v_gross_total := v_nights * v_room.prix_base_nuit;
  v_discount_total := v_nights * p_discount_per_night;
  
  -- 6. Insert Booking
  INSERT INTO public.bookings (
    room_id, tenant_id, agent_id, date_debut_prevue, date_fin_prevue, check_in_reel,
    prix_total, caution_encaissee, notes, status, created_at, updated_at
  ) VALUES (
    p_room_id, p_tenant_id, p_agent_id, v_forced_start_date, v_forced_end_date,
    CASE WHEN p_is_immediate_checkin THEN v_forced_start_date ELSE NULL END,
    p_prix_total,
    p_caution_encaissee, p_notes, CASE WHEN p_is_immediate_checkin THEN 'CONFIRMED' ELSE 'PENDING' END,
    NOW(), NOW()
  ) RETURNING id INTO v_booking_id;

  -- 7. Update Room Status
  IF p_is_immediate_checkin THEN
    UPDATE public.rooms SET status = 'Occupé', updated_at = NOW() WHERE id = p_room_id;
  END IF;

  -- 8. Payment & Invoice Logic
  v_final_usd := COALESCE(p_initial_payment_usd, 0);
  v_final_cdf := COALESCE(p_initial_payment_cdf, 0);
  v_final_amount := v_final_usd + (v_final_cdf / v_current_rate);

  v_invoice_number := 'FACT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

  IF v_final_amount >= p_prix_total THEN v_invoice_status := 'PAID';
  ELSIF v_final_amount > 0 THEN v_invoice_status := 'PARTIALLY_PAID';
  ELSE v_invoice_status := 'ISSUED';
  END IF;

  INSERT INTO public.invoices (
    booking_id, tenant_id, invoice_number, date, due_date, status, items, subtotal, total, 
    discount_amount, net_total, currency, notes, tenant_name, tenant_email, tenant_phone, 
    room_number, room_type, booking_start_date, booking_end_date, created_at, updated_at
  ) VALUES (
    v_booking_id, p_tenant_id, v_invoice_number, NOW(), v_forced_end_date, v_invoice_status,
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('id', gen_random_uuid(), 'description', 'Location Appartement - ' || v_room.numero || ' (' || v_room.type || ') - ' || v_nights || ' nuits', 'quantity', v_nights, 'unit_price', v_room.prix_base_nuit, 'total', v_gross_total)),
    v_gross_total, v_gross_total, v_discount_total, p_prix_total, 'USD',
    COALESCE(p_notes, 'Facture générée automatiquement'), v_tenant.prenom || ' ' || v_tenant.nom,
    v_tenant.email, v_tenant.telephone, v_room.numero, v_room.type,
    v_forced_start_date, v_forced_end_date, NOW(), NOW()
  ) RETURNING id INTO v_invoice_id;

  IF v_final_amount > 0 THEN
    INSERT INTO public.payments (
      booking_id, invoice_id, montant, montant_usd, montant_cdf, taux_change, date_paiement, methode, created_at
    ) VALUES (
      v_booking_id, v_invoice_id, v_final_amount, v_final_usd, v_final_cdf, v_current_rate, NOW(), 
      p_payment_method::public.payment_method, NOW()
    );
  END IF;

  RETURN json_build_object('id', v_booking_id, 'invoice_id', v_invoice_id, 'success', TRUE);
END;
$$ LANGUAGE plpgsql;
