-- Migration: Full Admin Booking Update Function
-- Date: 2026-08-25
-- Description: Permet à l'administrateur de modifier TOUS les champs d'une réservation (chambre, locataire, dates, prix, caution, notes, statuts, horodatages réels) avec synchronisation atomique de la facture et gestion du forçage de conflits.

CREATE OR REPLACE FUNCTION public.update_booking_with_invoice_atomic(
  p_booking_id UUID,
  p_room_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_date_debut_prevue TIMESTAMPTZ DEFAULT NULL,
  p_date_fin_prevue TIMESTAMPTZ DEFAULT NULL,
  p_prix_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_caution_encaissee NUMERIC DEFAULT NULL,
  p_check_in_reel TIMESTAMPTZ DEFAULT NULL,
  p_check_out_reel TIMESTAMPTZ DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_bypass_conflict BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_booking RECORD;
  v_room_id UUID;
  v_tenant_id UUID;
  v_date_debut TIMESTAMPTZ;
  v_date_fin TIMESTAMPTZ;
  v_prix_total NUMERIC;
  v_status TEXT;
  v_notes TEXT;
  v_caution NUMERIC;
  v_check_in_reel TIMESTAMPTZ;
  v_check_out_reel TIMESTAMPTZ;
  v_room RECORD;
  v_tenant RECORD;
  v_nights INTEGER;
  v_gross_total NUMERIC;
  v_discount_total NUMERIC;
  v_has_conflict BOOLEAN;
BEGIN
  -- 1. Récupérer la réservation existante
  SELECT * INTO v_old_booking FROM public.bookings WHERE id = p_booking_id;
  IF v_old_booking IS NULL THEN
    RAISE EXCEPTION 'Réservation introuvable: %', p_booking_id;
  END IF;

  -- 2. Déterminer les valeurs cibles (COALESCE avec les valeurs existantes)
  v_room_id := COALESCE(p_room_id, v_old_booking.room_id);
  v_tenant_id := COALESCE(p_tenant_id, v_old_booking.tenant_id);
  v_date_debut := COALESCE(p_date_debut_prevue, v_old_booking.date_debut_prevue);
  v_date_fin := COALESCE(p_date_fin_prevue, v_old_booking.date_fin_prevue);
  v_prix_total := COALESCE(p_prix_total, v_old_booking.prix_total);
  v_status := COALESCE(p_status, v_old_booking.status);
  v_notes := COALESCE(p_notes, v_old_booking.notes);
  v_caution := COALESCE(p_caution_encaissee, v_old_booking.caution_encaissee);
  v_check_in_reel := CASE WHEN p_check_in_reel IS NOT NULL THEN p_check_in_reel ELSE v_old_booking.check_in_reel END;
  v_check_out_reel := CASE WHEN p_check_out_reel IS NOT NULL THEN p_check_out_reel ELSE v_old_booking.check_out_reel END;

  IF v_date_fin <= v_date_debut THEN
    RAISE EXCEPTION 'La date de départ doit être après la date d''arrivée.';
  END IF;

  -- 3. Récupérer les informations de la chambre et du locataire
  SELECT * INTO v_room FROM public.rooms WHERE id = v_room_id;
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Chambre introuvable: %', v_room_id;
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_tenant_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Locataire introuvable: %', v_tenant_id;
  END IF;

  -- 4. Vérification des conflits (en excluant la réservation actuelle)
  v_has_conflict := public.check_booking_conflict(
    v_room_id,
    v_date_debut,
    v_date_fin,
    p_booking_id
  );

  IF v_has_conflict AND NOT p_bypass_conflict THEN
    RAISE EXCEPTION 'Conflit de date détecté pour cette chambre.' USING ERRCODE = 'P0001';
  END IF;

  -- 5. Gestion du transfert de chambre (si la chambre change)
  IF v_room_id <> v_old_booking.room_id THEN
    -- Libérer l'ancienne chambre si elle était occupée par ce séjour
    IF v_old_booking.status = 'IN_PROGRESS' THEN
      UPDATE public.rooms SET status = 'Disponible' WHERE id = v_old_booking.room_id AND status = 'Occupé';
      UPDATE public.rooms SET status = 'Occupé' WHERE id = v_room_id;
    END IF;
  END IF;

  -- 6. Mise à jour de la réservation
  UPDATE public.bookings
  SET 
    room_id = v_room_id,
    tenant_id = v_tenant_id,
    date_debut_prevue = v_date_debut,
    date_fin_prevue = v_date_fin,
    prix_total = v_prix_total,
    notes = v_notes,
    status = v_status,
    caution_encaissee = v_caution,
    check_in_reel = v_check_in_reel,
    check_out_reel = v_check_out_reel,
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- 7. Calculs et mise à jour de la facture associée
  v_nights := GREATEST(1, EXTRACT(DAY FROM (v_date_fin - v_date_debut)));
  v_gross_total := v_nights * v_room.prix_base_nuit;
  v_discount_total := GREATEST(0, v_gross_total - v_prix_total);

  UPDATE public.invoices
  SET
    tenant_id = v_tenant_id,
    tenant_name = TRIM(COALESCE(v_tenant.prenom, '') || ' ' || COALESCE(v_tenant.nom, '')),
    tenant_email = v_tenant.email,
    tenant_phone = v_tenant.telephone,
    room_number = v_room.numero,
    room_type = v_room.type,
    booking_start_date = v_date_debut,
    booking_end_date = v_date_fin,
    subtotal = v_gross_total,
    total = v_gross_total,
    discount_amount = v_discount_total,
    net_total = v_prix_total,
    items = JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'id', gen_random_uuid(), 
      'description', 'Location ' || v_room.type || ' - ' || v_nights || ' nuits (Mise à jour)',
      'quantity', v_nights, 
      'unit_price', v_room.prix_base_nuit, 
      'total', v_gross_total
    )),
    updated_at = NOW()
  WHERE booking_id = p_booking_id;

  RETURN JSON_BUILD_OBJECT('success', TRUE, 'booking_id', p_booking_id);
END;
$$;
