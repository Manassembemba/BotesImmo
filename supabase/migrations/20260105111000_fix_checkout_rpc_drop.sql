-- Migration: Correction du RPC de départ (DROP & RECREATE)
-- Date: 2026-01-05
-- Description: Supprime explicitement l'ancienne version de la fonction pour éviter les conflits de signature (overloading) et l'erreur 22P02.

-- 1. Supprimer l'ancienne signature (3 args) si elle existe encore surchargée
DROP FUNCTION IF EXISTS public.confirm_departure_and_cleanup(UUID, UUID, UUID);

-- 2. Supprimer la nouvelle signature (5 args) pour être sûr de repartir à zéro
DROP FUNCTION IF EXISTS public.confirm_departure_and_cleanup(UUID, UUID, UUID, NUMERIC, INTEGER);

-- 3. Recréer la fonction propre
CREATE OR REPLACE FUNCTION public.confirm_departure_and_cleanup(
    p_booking_id UUID, 
    p_room_id UUID, 
    p_agent_id UUID,
    p_debt_amount NUMERIC DEFAULT 0,
    p_overdue_days INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    room_number TEXT;
    v_invoice_id UUID;
    v_current_items JSONB;
BEGIN
    -- Validation basique des UUIDs pour éviter des erreurs obscures plus loin
    IF p_booking_id IS NULL OR p_room_id IS NULL OR p_agent_id IS NULL THEN
        RAISE EXCEPTION 'Les IDs (Booking, Room, Agent) sont obligatoires.';
    END IF;

    -- 1. Update booking status
    UPDATE public.bookings
    SET
        status = 'COMPLETED',
        check_out_reel = NOW(),
        updated_at = NOW()
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Impossible de trouver la réservation %', p_booking_id;
    END IF;

    -- 2. Traitement de la dette si existante
    -- On s'assure que p_debt_amount est traité comme 0 si NULL
    IF COALESCE(p_debt_amount, 0) > 0 THEN
        -- Récupérer la facture active
        SELECT id, items INTO v_invoice_id, v_current_items
        FROM public.invoices
        WHERE booking_id = p_booking_id
        AND status != 'CANCELLED'
        LIMIT 1;

        IF v_invoice_id IS NOT NULL THEN
            -- Ajouter la ligne de dette
            UPDATE public.invoices
            SET
                items = v_current_items || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'description', 'Frais de dépassement de séjour (' || COALESCE(p_overdue_days, 0) || ' jours de retard)',
                    'quantity', GREATEST(COALESCE(p_overdue_days, 1), 1), -- Eviter 0 ou null
                    'unit_price', p_debt_amount / GREATEST(COALESCE(p_overdue_days, 1), 1),
                    'total', p_debt_amount
                ),
                subtotal = subtotal + p_debt_amount,
                total = total + p_debt_amount,
                net_total = net_total + p_debt_amount,
                updated_at = NOW()
            WHERE id = v_invoice_id;
        END IF;
    END IF;

    -- 3. Get room number for task
    SELECT numero INTO room_number FROM public.rooms WHERE id = p_room_id;

    -- 4. Update room status
    UPDATE public.rooms
    SET
        status = 'Nettoyage',
        updated_at = NOW()
    WHERE id = p_room_id;

    -- 5. Create cleaning task
    INSERT INTO public.tasks (room_id, type_tache, description, status_tache, assigned_to_user_id, date_creation)
    VALUES (
        p_room_id,
        'NETTOYAGE',
        'Nettoyage après départ - Chambre ' || room_number,
        'TO_DO',
        p_agent_id,
        NOW()
    );
END;
$$;
