-- 1. Create the function that updates an invoice's paid amount and status
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_paid NUMERIC;
    v_invoice_total NUMERIC;
    v_new_status TEXT;
BEGIN
    IF p_invoice_id IS NULL THEN
        RAISE NOTICE 'update_invoice_payment_status: called with NULL invoice_id. Skipping.';
        RETURN;
    END IF;

    RAISE NOTICE 'update_invoice_payment_status: Running for invoice ID %', p_invoice_id;

    -- Calculate the sum of all payments for the given invoice
    SELECT COALESCE(SUM(montant), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE invoice_id = p_invoice_id;

    RAISE NOTICE 'update_invoice_payment_status: Total paid for invoice % is %', p_invoice_id, v_total_paid;

    -- Get the invoice's total amount
    SELECT COALESCE(net_total, total)
    INTO v_invoice_total
    FROM public.invoices
    WHERE id = p_invoice_id;

    -- Determine the new status
    IF v_total_paid >= v_invoice_total THEN
        v_new_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'PARTIALLY_PAID';
    ELSE
        v_new_status := 'ISSUED';
    END IF;
    
    RAISE NOTICE 'update_invoice_payment_status: New status for invoice % will be %', p_invoice_id, v_new_status;

    -- Update the invoice with the new calculated values
    UPDATE public.invoices
    SET
        amount_paid = v_total_paid,
        status = v_new_status
    WHERE id = p_invoice_id;

    RAISE NOTICE 'update_invoice_payment_status: Successfully updated invoice %', p_invoice_id;
END;
$$;

-- 2. Create the trigger function that calls the update function
CREATE OR REPLACE FUNCTION public.handle_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- When a payment is inserted or updated, update the corresponding invoice
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        PERFORM public.update_invoice_payment_status(NEW.invoice_id);
    END IF;

    -- When a payment is deleted, or if its invoice_id was changed during an update,
    -- update the invoice it was previously associated with.
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        PERFORM public.update_invoice_payment_status(OLD.invoice_id);
    END IF;

    -- The function must return NEW for INSERT/UPDATE and OLD for DELETE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        RETURN NEW;
    ELSE
        RETURN OLD;
    END IF;
END;
$$;

-- 3. Create the trigger on the payments table
-- This trigger will fire after any insert, update, or delete on the payments table.
DROP TRIGGER IF EXISTS on_payment_change_update_invoice ON public.payments;
CREATE TRIGGER on_payment_change_update_invoice
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_change();

COMMENT ON TRIGGER on_payment_change_update_invoice ON public.payments IS 'After a payment is modified, calls a function to update the status and totals of the related invoice.';
