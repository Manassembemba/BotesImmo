CREATE OR REPLACE FUNCTION get_payments_with_details(
    p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    booking_id UUID,
    invoice_id UUID,
    montant NUMERIC,
    montant_usd NUMERIC,
    montant_cdf NUMERIC,
    taux_change NUMERIC,
    date_paiement TIMESTAMP WITH TIME ZONE,
    methode TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    location_id UUID,
    room_numero TEXT,
    tenant_nom TEXT,
    tenant_prenom TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- RLS is enforced because this function is SECURITY INVOKER by default.
    -- Non-admins will only see data from their own location.
    -- Admins will see all data unless filtered by p_location_id.
    RETURN QUERY
    SELECT
        p.id,
        p.booking_id,
        p.invoice_id,
        p.montant,
        p.montant_usd,
        p.montant_cdf,
        p.taux_change,
        p.date_paiement,
        p.methode::TEXT,  -- Cast the enum to TEXT to match the return type
        p.notes,
        p.created_at,
        r.location_id,
        r.numero AS room_numero,
        t.nom AS tenant_nom,
        t.prenom AS tenant_prenom
    FROM
        public.payments p
    LEFT JOIN
        public.bookings b ON p.booking_id = b.id
    LEFT JOIN
        public.rooms r ON b.room_id = r.id
    LEFT JOIN
        public.tenants t ON b.tenant_id = t.id
    WHERE
        (p_location_id IS NULL OR r.location_id = p_location_id);
END;
$$;
