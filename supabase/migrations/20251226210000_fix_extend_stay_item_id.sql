-- This migration provides the final fix for the extend_stay function.
-- It ensures that the line item created within the 'items' JSONB array
-- includes a unique 'id', making its structure identical to invoices
-- created on the client-side and resolving the silent query failure.

CREATE OR REPLACE FUNCTION public.extend_stay(
    p_booking_id uuid,
    p_new_date_fin_prevue timestamptz,
    p_new_prix_total real
)
RETURNS public.bookings
LANGUAGE plpgsql
AS $$
DECLARE
    v_original_booking public.bookings;
    v_updated_booking public.bookings;
    v_forced_new_end_date timestamptz;
    v_additional_cost real;
    v_invoice_description text;
    v_invoice_number text;
    v_tenant public.tenants;
    v_room public.rooms;
BEGIN
    -- Force the new end date time to 11:00:00 AM
    v_forced_new_end_date := (p_new_date_fin_prevue::date + interval '11 hours')::timestamptz;

    -- Retrieve original booking details before updating
    SELECT * INTO v_original_booking FROM public.bookings WHERE id = p_booking_id;

    IF v_original_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking with ID % not found', p_booking_id;
    END IF;

    -- Update the booking with the new end date and total price
    UPDATE public.bookings
    SET
        date_fin_prevue = v_forced_new_end_date,
        prix_total = p_new_prix_total,
        status = 'CONFIRMED',
        updated_at = NOW()
    WHERE id = p_booking_id
    RETURNING * INTO v_updated_booking;

    -- Calculate additional cost
    v_additional_cost := p_new_prix_total - v_original_booking.prix_total;

    -- If there's an additional cost, create a new invoice for the extension
    IF v_additional_cost > 0 THEN
        BEGIN
            v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MI') || '-' || SUBSTRING(v_updated_booking.id::text FROM 1 FOR 4);
            SELECT * INTO v_tenant FROM public.tenants WHERE id = v_updated_booking.tenant_id;
            SELECT * INTO v_room FROM public.rooms WHERE id = v_updated_booking.room_id;

            v_invoice_description := 'Facture d''extension de séjour pour réservation ' || v_original_booking.id ||
                                     ' du ' || TO_CHAR(v_original_booking.date_fin_prevue, 'DD/MM/YYYY') || ' (11h00)' ||
                                     ' au ' || TO_CHAR(v_updated_booking.date_fin_prevue, 'DD/MM/YYYY') || ' (11h00)';

            INSERT INTO public.invoices (
                invoice_number, date, due_date, booking_id, tenant_id, status, items, subtotal, total, 
                discount_amount, net_total, amount_paid,
                currency, notes,
                tenant_name, tenant_email, tenant_phone, room_number, room_type, booking_start_date, booking_end_date
            ) VALUES (
                v_invoice_number, NOW(), (NOW() + INTERVAL '7 days')::date, v_updated_booking.id, v_updated_booking.tenant_id, 'ISSUED',
                JSONB_BUILD_ARRAY(
                    JSONB_BUILD_OBJECT(
                        'id', gen_random_uuid(), -- Add the missing ID to the line item
                        'description', 'Coût additionnel pour prolongation de séjour', 
                        'quantity', 1, 
                        'unit_price', v_additional_cost, 
                        'total', v_additional_cost
                    )
                ),
                v_additional_cost, v_additional_cost, 
                0, v_additional_cost, 0,
                'USD', v_invoice_description,
                v_tenant.prenom || ' ' || v_tenant.nom, v_tenant.email, v_tenant.telephone, v_room.numero, v_room.type,
                v_original_booking.date_debut_prevue, v_updated_booking.date_fin_prevue
            );
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'extend_stay: An error occurred during invoice creation for booking %. SQLSTATE: %, SQLERRM: %', p_booking_id, SQLSTATE, SQLERRM;
                RAISE; 
        END;
    END IF;

    return v_updated_booking;
END;
$$;
