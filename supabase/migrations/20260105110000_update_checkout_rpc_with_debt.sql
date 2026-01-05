-- Migration: Mise à jour du RPC de départ pour intégrer la dette
-- Date: 2026-01-05

CREATE OR REPLACE FUNCTION public.confirm_departure_and_cleanup(
    p_booking_id UUID, 
    p_room_id UUID, 
    p_agent_id UUID,
    p_debt_amount NUMERIC DEFAULT 0,
    p_overdue_days INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    room_number TEXT;
    v_invoice_id UUID;
    v_current_items JSONB;
BEGIN
    -- 1. Update booking status
    UPDATE public.bookings
    SET
        status = 'COMPLETED',
        check_out_reel = NOW(),
        updated_at = NOW()
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking with ID % not found', p_booking_id;
    END IF;

    -- 2. Traitement de la dette si existante
    IF p_debt_amount > 0 THEN
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
                    'description', 'Frais de dépassement de séjour (' || p_overdue_days || ' jours de retard)',
                    'quantity', p_overdue_days,
                    'unit_price', p_debt_amount / GREATEST(p_overdue_days, 1),
                    'total', p_debt_amount
                ),
                subtotal = subtotal + p_debt_amount,
                total = total + p_debt_amount,
                net_total = net_total + p_debt_amount,
                -- Le statut reste inchangé ou passe à PARTIAL si c'était PAID ?
                -- Pour simplicité, si le net_total augmente et dépasse amount_paid, ça redeviendra mathématiquement incomplet
                updated_at = NOW()
            WHERE id = v_invoice_id;
        END IF;
    END IF;

    -- 3. Get room number for task
    SELECT numero INTO room_number FROM public.rooms WHERE id = p_room_id;

    -- 4. Update room status
    UPDATE public.rooms
    SET
        status = 'A_NETTOYER',
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
