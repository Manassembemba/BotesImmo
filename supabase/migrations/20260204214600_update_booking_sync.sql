-- Migration Part 2: Unifier update_booking_with_invoice_atomic
CREATE OR REPLACE FUNCTION public.update_booking_with_invoice_atomic(
  p_booking_id UUID,
  p_date_debut_prevue TIMESTAMPTZ,
  p_date_fin_prevue TIMESTAMPTZ,
  p_prix_total NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_bypass_conflict BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id UUID;
  v_room_id UUID;
  v_nights INTEGER;
  v_room RECORD;
  v_gross_total NUMERIC;
  v_discount_total NUMERIC;
  v_has_conflict BOOLEAN;
BEGIN
  -- 1. Récupérer les infos existantes
  SELECT room_id INTO v_room_id FROM public.bookings WHERE id = p_booking_id;
  SELECT * INTO v_room FROM public.rooms WHERE id = v_room_id;
  
  -- 2. Vérification de conflit via la fonction unifiée
  v_has_conflict := public.check_booking_conflict(
    v_room_id,
    p_date_debut_prevue,
    p_date_fin_prevue,
    p_booking_id -- On exclut la réservation en cours
  );

  IF v_has_conflict AND NOT p_bypass_conflict THEN
    RAISE EXCEPTION 'Conflit de date détecté pour cette chambre.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Mettre à jour la réservation
  UPDATE public.bookings
  SET 
    date_debut_prevue = p_date_debut_prevue,
    date_fin_prevue = p_date_fin_prevue,
    prix_total = p_prix_total,
    notes = COALESCE(p_notes, notes),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_booking_id;

  -- 4. Mettre à jour la facture associée
  v_nights := GREATEST(1, EXTRACT(DAY FROM (p_date_fin_prevue - p_date_debut_prevue)));
  v_gross_total := v_nights * v_room.prix_base_nuit;
  v_discount_total := v_gross_total - p_prix_total;

  UPDATE public.invoices
  SET
    booking_start_date = p_date_debut_prevue,
    booking_end_date = p_date_fin_prevue,
    subtotal = v_gross_total,
    total = v_gross_total,
    discount_amount = v_discount_total,
    net_total = p_prix_total,
    items = JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'id', gen_random_uuid(), 
      'description', 'Location ' || v_room.type || ' - ' || v_nights || ' nuits (Mise à jour)',
      'quantity', v_nights, 
      'unit_price', v_room.prix_base_nuit, 
      'total', v_gross_total
    )),
    updated_at = now()
  WHERE booking_id = p_booking_id;

  RETURN JSON_BUILD_OBJECT('success', TRUE, 'booking_id', p_booking_id);
END;
$$;
