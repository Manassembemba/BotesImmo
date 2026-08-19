-- Migration: Prolongation atomique de séjour avec paiement bi-devise immédiat (USD / CDF)
-- Date: 19 août 2026

CREATE OR REPLACE FUNCTION public.extend_stay_atomic(
  p_booking_id UUID,
  p_new_date_fin_prevue TIMESTAMPTZ,
  p_new_prix_total NUMERIC,
  p_extension_discount_per_night NUMERIC DEFAULT 0,
  p_initial_payment_usd NUMERIC DEFAULT 0,
  p_initial_payment_cdf NUMERIC DEFAULT 0,
  p_exchange_rate NUMERIC DEFAULT 2800,
  p_payment_method TEXT DEFAULT 'CASH'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_booking RECORD;
  v_room RECORD;
  v_tenant RECORD;
  v_additional_nights INTEGER;
  v_extension_gross_cost NUMERIC;
  v_extension_discount_amount NUMERIC;
  v_extension_net_cost NUMERIC;
  v_total_payment_usd NUMERIC;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_invoice_status TEXT;
  v_payment_id UUID;
  v_stay_description TEXT;
  v_forced_end_date TIMESTAMPTZ;
  v_original_end_date TIMESTAMPTZ;
  v_rate NUMERIC;
BEGIN
  -- 1. Récupérer la réservation originale
  SELECT * INTO v_original_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation non trouvée.';
  END IF;

  -- 2. Récupérer la chambre
  SELECT * INTO v_room FROM public.rooms WHERE id = v_original_booking.room_id;
  
  -- 3. Récupérer le locataire
  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_original_booking.tenant_id;

  -- 4. Forcer l'heure de fin à 11:00 AM
  v_forced_end_date := (p_new_date_fin_prevue::date + time '11:00')::timestamp with time zone;
  v_original_end_date := v_original_booking.date_fin_prevue;

  -- 5. Vérifier les conflits
  IF EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE room_id = v_original_booking.room_id 
    AND id != p_booking_id
    AND status NOT IN ('CANCELLED', 'EXTENDED')
    AND (
      (v_original_end_date, v_forced_end_date) OVERLAPS (date_debut_prevue, date_fin_prevue)
    )
  ) THEN
    RAISE EXCEPTION 'Conflit de date détecté pour la période de prolongation.';
  END IF;

  -- 6. Calculer les nuits additionnelles
  v_additional_nights := EXTRACT(DAY FROM (v_forced_end_date - v_original_end_date))::INTEGER;
  IF v_additional_nights <= 0 THEN
    RAISE EXCEPTION 'La prolongation doit être d''au moins une nuit.';
  END IF;

  -- 7. Mettre à jour la réservation
  UPDATE public.bookings
  SET 
    date_fin_prevue = v_forced_end_date,
    prix_total = p_new_prix_total,
    status = 'CONFIRMED',
    updated_at = now()
  WHERE id = p_booking_id;

  -- 8. Calculer les coûts d'extension
  v_extension_gross_cost := v_additional_nights * v_room.prix_base_nuit;
  v_extension_discount_amount := v_additional_nights * COALESCE(p_extension_discount_per_night, 0);
  v_extension_net_cost := v_extension_gross_cost - v_extension_discount_amount;

  -- 9. Calcul du paiement total en USD
  v_rate := COALESCE(p_exchange_rate, 2800);
  IF v_rate <= 0 THEN v_rate := 2800; END IF;

  v_total_payment_usd := COALESCE(p_initial_payment_usd, 0) + (COALESCE(p_initial_payment_cdf, 0) / v_rate);

  -- 10. Créer la facture d'extension (si coût > 0)
  IF v_extension_net_cost > 0 THEN
    v_invoice_number := 'INV-EXT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(md5(random()::text), 1, 4);
    v_stay_description := 'Extension ' || v_room.type || ' n°' || v_room.numero || ' - ' || v_additional_nights || ' nuits';

    IF v_total_payment_usd >= v_extension_net_cost THEN
      v_invoice_status := 'PAID';
    ELSIF v_total_payment_usd > 0 THEN
      v_invoice_status := 'PARTIALLY_PAID';
    ELSE
      v_invoice_status := 'ISSUED';
    END IF;

    INSERT INTO public.invoices (
      invoice_number,
      date,
      due_date,
      booking_id,
      tenant_id,
      status,
      items,
      subtotal,
      total,
      discount_amount,
      net_total,
      amount_paid,
      currency,
      notes,
      tenant_name,
      tenant_email,
      tenant_phone,
      room_number,
      room_type,
      booking_start_date,
      booking_end_date
    ) VALUES (
      v_invoice_number,
      now(),
      now() + interval '7 days',
      p_booking_id,
      v_original_booking.tenant_id,
      v_invoice_status,
      JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'id', gen_random_uuid(),
        'description', v_stay_description,
        'quantity', v_additional_nights,
        'unit_price', v_room.prix_base_nuit,
        'total', v_extension_gross_cost
      )),
      v_extension_gross_cost,
      v_extension_gross_cost,
      v_extension_discount_amount,
      v_extension_net_cost,
      v_total_payment_usd,
      'USD',
      'Facture d''extension de séjour.',
      v_tenant.prenom || ' ' || v_tenant.nom,
      v_tenant.email,
      v_tenant.telephone,
      v_room.numero,
      v_room.type,
      v_original_end_date,
      v_forced_end_date
    ) RETURNING id INTO v_invoice_id;

    -- 11. Créer le paiement si un montant a été versé
    IF v_total_payment_usd > 0 AND v_invoice_id IS NOT NULL THEN
      INSERT INTO public.payments (
        booking_id,
        invoice_id,
        montant,
        methode,
        date_paiement,
        notes,
        montant_usd,
        montant_cdf,
        exchange_rate
      ) VALUES (
        p_booking_id,
        v_invoice_id,
        v_total_payment_usd,
        COALESCE(p_payment_method, 'CASH')::payment_method,
        now(),
        'Paiement à la prolongation de séjour',
        COALESCE(p_initial_payment_usd, 0),
        COALESCE(p_initial_payment_cdf, 0),
        v_rate
      ) RETURNING id INTO v_payment_id;
    END IF;

  END IF;

  RETURN JSON_BUILD_OBJECT(
    'success', TRUE,
    'booking_id', p_booking_id,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'additional_nights', v_additional_nights,
    'extension_net_cost', v_extension_net_cost,
    'amount_paid', v_total_payment_usd
  );
END;
$$;
