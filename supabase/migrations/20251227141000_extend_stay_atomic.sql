-- Migration: Transaction atomique pour prolongation de séjour avec facture
-- Objectif: Garantir la cohérence des données (rollback automatique si erreur)
-- Remplace: Edge Function extend-stay et RPC extend_stay

-- Fonction RPC pour prolonger un séjour de manière atomique
CREATE OR REPLACE FUNCTION public.extend_stay_atomic(
  p_booking_id UUID,
  p_new_date_fin_prevue TIMESTAMPTZ,
  p_new_prix_total NUMERIC,
  p_extension_discount_per_night NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_booking RECORD;
  v_updated_booking RECORD;
  v_room RECORD;
  v_tenant RECORD;
  v_invoice_id UUID;
  v_additional_nights INTEGER;
  v_extension_gross NUMERIC;
  v_extension_discount NUMERIC;
  v_extension_net NUMERIC;
  v_invoice_number TEXT;
  v_forced_new_end_date TIMESTAMPTZ;
BEGIN
  RAISE NOTICE 'extend_stay_atomic: Début pour booking %', p_booking_id;

  -- Validation des paramètres
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking_id est requis';
  END IF;

  -- Forcer l'heure à 11:00:00 pour la nouvelle date de fin
  v_forced_new_end_date := (p_new_date_fin_prevue::DATE + INTERVAL '11 hours')::TIMESTAMPTZ;
  RAISE NOTICE 'extend_stay_atomic: Nouvelle date de fin forcée à 11h00: %', v_forced_new_end_date;

  -- 1. RÉCUPÉRER LA RÉSERVATION ORIGINALE
  SELECT * INTO v_original_booking 
  FROM public.bookings 
  WHERE id = p_booking_id;

  IF v_original_booking IS NULL THEN
    RAISE EXCEPTION 'Réservation introuvable: %', p_booking_id;
  END IF;

  RAISE NOTICE 'extend_stay_atomic: Réservation trouvée (prix original: %)', v_original_booking.prix_total;

  -- Validation: nouvelle date doit être après la date actuelle
  IF v_forced_new_end_date <= v_original_booking.date_fin_prevue THEN
    RAISE EXCEPTION 'La nouvelle date de fin (%) doit être après la date actuelle (%)', 
                    v_forced_new_end_date, v_original_booking.date_fin_prevue;
  END IF;

  -- 2. VÉRIFIER LES CONFLITS DE RÉSERVATION
  PERFORM 1 FROM public.check_booking_conflict(
    v_original_booking.room_id,
    v_original_booking.date_fin_prevue,
    v_forced_new_end_date,
    p_booking_id -- Exclure la réservation actuelle
  );

  RAISE NOTICE 'extend_stay_atomic: Aucun conflit détecté';

  -- 3. RÉCUPÉRER LES INFORMATIONS DE LA CHAMBRE ET DU LOCATAIRE
  SELECT * INTO v_room FROM public.rooms WHERE id = v_original_booking.room_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_original_booking.tenant_id;

  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Chambre introuvable: %', v_original_booking.room_id;
  END IF;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Locataire introuvable: %', v_original_booking.tenant_id;
  END IF;

  -- 4. CALCULER LES NUITS ADDITIONNELLES ET LES MONTANTS
  v_additional_nights := EXTRACT(DAY FROM (v_forced_new_end_date - v_original_booking.date_fin_prevue));

  IF v_additional_nights <= 0 THEN
    RAISE EXCEPTION 'Le nombre de nuits additionnelles doit être > 0 (calculé: %)', v_additional_nights;
  END IF;

  v_extension_gross := v_additional_nights * v_room.prix_base_nuit;
  v_extension_discount := v_additional_nights * p_extension_discount_per_night;
  v_extension_net := v_extension_gross - v_extension_discount;

  RAISE NOTICE 'extend_stay_atomic: % nuits additionnelles - Brut: %, Réduction: %, Net: %',
               v_additional_nights, v_extension_gross, v_extension_discount, v_extension_net;

  -- 5. METTRE À JOUR LA RÉSERVATION
  UPDATE public.bookings
  SET
    date_fin_prevue = v_forced_new_end_date,
    prix_total = p_new_prix_total,
    status = 'CONFIRMED',
    updated_at = NOW()
  WHERE id = p_booking_id
  RETURNING * INTO v_updated_booking;

  RAISE NOTICE 'extend_stay_atomic: Réservation mise à jour (nouveau prix total: %)', p_new_prix_total;

  -- 6. CRÉER LA FACTURE D'EXTENSION (si coût net > 0)
  IF v_extension_net > 0 THEN
    RAISE NOTICE 'extend_stay_atomic: Création de la facture d''extension';

    -- Générer numéro de facture unique
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MI') || '-' || 
                        SUBSTRING(v_updated_booking.id::TEXT FROM 1 FOR 4);

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
      booking_end_date,
      created_at,
      updated_at
    ) VALUES (
      v_invoice_number,
      NOW(),
      (NOW() + INTERVAL '7 days')::DATE,
      v_updated_booking.id,
      v_updated_booking.tenant_id,
      'ISSUED',
      JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
          'id', gen_random_uuid(),
          'description', 'Extension de séjour - Location ' || v_room.type || ' - ' || 
                         v_additional_nights || ' nuits du ' || 
                         TO_CHAR(v_original_booking.date_fin_prevue, 'DD/MM/YYYY') || ' au ' || 
                         TO_CHAR(v_updated_booking.date_fin_prevue, 'DD/MM/YYYY'),
          'quantity', v_additional_nights,
          'unit_price', v_room.prix_base_nuit,
          'total', v_extension_gross
        )
      ),
      v_extension_gross,
      v_extension_gross,
      v_extension_discount,
      v_extension_net,
      0, -- Pas encore payé
      'USD',
      'Facture d''extension de séjour pour réservation ' || v_original_booking.id || 
      ' du ' || TO_CHAR(v_original_booking.date_fin_prevue, 'DD/MM/YYYY') || 
      ' au ' || TO_CHAR(v_updated_booking.date_fin_prevue, 'DD/MM/YYYY'),
      v_tenant.prenom || ' ' || v_tenant.nom,
      v_tenant.email,
      v_tenant.telephone,
      v_room.numero,
      v_room.type,
      v_original_booking.date_fin_prevue, -- Date de début de l'extension
      v_updated_booking.date_fin_prevue,
      NOW(),
      NOW()
    ) RETURNING id INTO v_invoice_id;

    RAISE NOTICE 'extend_stay_atomic: Facture créée: %', v_invoice_number;
  ELSE
    RAISE NOTICE 'extend_stay_atomic: Coût net <= 0, aucune facture créée';
  END IF;

  -- 7. RETOURNER LE RÉSULTAT
  RETURN JSON_BUILD_OBJECT(
    'success', TRUE,
    'booking_id', v_updated_booking.id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'original_end_date', v_original_booking.date_fin_prevue,
    'new_end_date', v_updated_booking.date_fin_prevue,
    'additional_nights', v_additional_nights,
    'extension_gross', v_extension_gross,
    'extension_discount', v_extension_discount,
    'extension_net', v_extension_net,
    'new_total_price', p_new_prix_total,
    'booking', ROW_TO_JSON(v_updated_booking)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, PostgreSQL fait automatiquement un ROLLBACK
    RAISE EXCEPTION 'Erreur lors de la prolongation: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;
