-- Migration finale pour s'assurer que toutes les fonctions RPC sont correctement mises à jour avec les casts appropriés

-- Mise à jour de la fonction get_payments_with_details avec les casts corrects
DROP FUNCTION IF EXISTS get_payments_with_details(UUID);

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
        p.methode::TEXT,
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

-- Mise à jour de la fonction get_tasks avec les casts corrects
DROP FUNCTION IF EXISTS get_tasks(UUID);

CREATE OR REPLACE FUNCTION get_tasks(
    p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    type_tache TEXT,
    description TEXT,
    assigned_to_user_id UUID,
    status_tache TEXT,
    date_creation TIMESTAMP WITH TIME ZONE,
    date_completion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    room_numero TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.room_id,
        t.type_tache::TEXT,
        t.description,
        t.assigned_to_user_id,
        t.status_tache::TEXT,
        t.date_creation,
        t.date_completion,
        t.created_at,
        t.updated_at,
        r.numero AS room_numero
    FROM
        public.tasks t
    LEFT JOIN
        public.rooms r ON t.room_id = r.id
    WHERE
        (p_location_id IS NULL OR r.location_id = p_location_id);
END;
$$;