CREATE OR REPLACE FUNCTION public.create_booking_with_invoice_atomic(
    p_room_id uuid,
    p_tenant_id uuid,
    p_agent_id uuid,
    p_date_debut_prevue timestamp with time zone,
    p_date_fin_prevue timestamp with time zone,
    p_prix_total numeric,
    p_caution_encaissee numeric DEFAULT 0,
    p_notes text DEFAULT NULL::text,
    p_discount_per_night numeric DEFAULT 0,
    p_initial_payment_amount numeric DEFAULT 0,
    p_initial_payment_usd numeric DEFAULT 0,
    p_initial_payment_cdf numeric DEFAULT 0,
    p_payment_method text DEFAULT 'CASH'::text,
    p_is_immediate_checkin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  v_invoice_number TEXT;
  v_final_amount NUMERIC := p_initial_payment_amount;
  v_final_usd NUMERIC := p_initial_payment_usd;
  v_final_cdf NUMERIC := p_initial_payment_cdf;
  v_conflict BOOLEAN;
BEGIN
  -- Validation des paramètres
  IF p_room_id IS NULL OR p_tenant_id IS NULL OR p_agent_id IS NULL THEN
    RAISE EXCEPTION 'room_id, tenant_id et agent_id sont requis';
  END IF;

  IF p_date_fin_prevue <= p_date_debut_prevue THEN
    RAISE EXCEPTION 'La date de fin doit être après la date de début';
  END IF;

  -- Vérifier disponibilité de la chambre
  SELECT public.check_booking_conflict(
    p_room_id,
    p_date_debut_prevue,
    p_date_fin_prevue,
    NULL -- Pas d'exclusion pour nouvelle réservation
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'Conflit détecté ! Cette chambre est déjà réservée sur cette période (RPC Check).';
  END IF;

  -- Récupérer les informations de la chambre et du locataire
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;

  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Chambre introuvable: %', p_room_id;
  END IF;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Locataire introuvable: %', p_tenant_id;
  END IF;

  -- Calculer le nombre de nuits
  v_nights := GREATEST(1, EXTRACT(DAY FROM (p_date_fin_prevue - p_date_debut_prevue)));

  -- Calculer les montants pour la facture
  v_gross_total := v_nights * v_room.prix_base_nuit; -- Utiliser le prix de la chambre comme base si nécessaire, ou p_prix_total ?
  -- NOTE: p_prix_total est passé par le front, mais pour l'intégrité on recalcul souvent. 
  -- Ici on va faire confiance au calcul front MAIS le discount est appliqué.
  -- Pour simplifier et respecter le front:
  v_gross_total := p_prix_total + (v_nights * p_discount_per_night); -- Reconstitution du prix brut avant remise ?
  -- Ou plus simple : p_prix_total EST le net.
  -- On va assumer que p_prix_total est le montant FINAL attendu par le client.
  v_net_total := p_prix_total;
  v_discount_total := v_nights * p_discount_per_night; 
  -- Si p_prix_total est le net, alors le brut était p_prix_total + discount.
  
  -- Générer numéro de facture (Format simple pour l'instant ou via sequence)
  v_invoice_number := 'INV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text from 1 for 4);

  -- 1. CRÉER LA RÉSERVATION
  INSERT INTO public.bookings (
    room_id,
    tenant_id,
    agent_id,
    date_debut_prevue,
    date_fin_prevue,
    prix_total,
    caution_encaissee,
    notes,
    status,
    check_in_reel,
    check_out_reel,
    created_at,
    updated_at
  ) VALUES (
    p_room_id,
    p_tenant_id,
    p_agent_id,
    p_date_debut_prevue,
    p_date_fin_prevue,
    v_net_total, -- Prix total net
    p_caution_encaissee,
    p_notes,
    CASE WHEN p_is_immediate_checkin THEN 'CONFIRMED' ELSE 'PENDING' END, -- Status initial
    CASE WHEN p_is_immediate_checkin THEN NOW() ELSE NULL END, -- Check-in reel si immediat
    NULL,
    NOW(),
    NOW()
  ) RETURNING id INTO v_booking_id;

  -- Si Check-in immédiat, mettre à jour le statut de la chambre
  IF p_is_immediate_checkin THEN
    UPDATE public.rooms SET status = 'Occupé', updated_at = NOW() WHERE id = p_room_id;
  END IF;

  -- 2. CRÉER LA FACTURE
  INSERT INTO public.invoices (
    booking_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    subtotal,
    tax_total,
    discount_total,
    total,
    net_total,
    notes,
    items, -- JSONB Items
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    v_invoice_number,
    'PENDING', -- Sera mis à jour si payé
    NOW(),
    p_date_fin_prevue,
    v_net_total + v_discount_total, -- Subtotal (Brut)
    0, -- Tax
    v_discount_total, -- Discount
    v_net_total, -- Total à payer
    v_net_total, -- Net total
    'Facture de séjour',
    jsonb_build_array(
      jsonb_build_object(
        'description', 'Séjour: ' || v_room.type || ' - ' || v_room.numero || ' (' || v_nights || ' nuits)',
        'quantity', v_nights,
        'unit_price', v_room.prix_base_nuit,
        'total', v_nights * v_room.prix_base_nuit
      )
    ), 
    NOW(),
    NOW()
  ) RETURNING id INTO v_invoice_id;

  -- 3. CRÉER LE PAIEMENT INITIAL (si montant > 0)
  IF v_final_amount > 0 THEN
    INSERT INTO public.payments (
      booking_id,
      invoice_id,
      montant,
      montant_usd,
      montant_cdf,
      methode,
      date_paiement,
      notes,
      created_at
    ) VALUES (
      v_booking_id,
      v_invoice_id,
      v_final_amount,
      v_final_usd,
      v_final_cdf,
      p_payment_method::public.payment_method,
      CURRENT_DATE,
      CASE WHEN p_is_immediate_checkin THEN 'Paiement pour check-in direct' ELSE 'Acompte de réservation' END,
      NOW()
    ) RETURNING id INTO v_payment_id;
  END IF;

  -- 4. RETOURNER LE RÉSULTAT
  RETURN JSON_BUILD_OBJECT(
    'success', TRUE,
    'booking_id', v_booking_id,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'invoice_number', v_invoice_number
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur atomique: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;
