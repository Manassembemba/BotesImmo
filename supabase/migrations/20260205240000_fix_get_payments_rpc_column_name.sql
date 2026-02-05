-- Migration: Fix get_payments_with_details RPC function to use exchange_rate column
-- Date: 5 février 2026
-- Objectif: Mettre à jour la fonction RPC pour référencer la colonne exchange_rate au lieu de taux_change

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS get_payments_with_details(UUID);

-- Recréer la fonction avec la bonne colonne
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
    exchange_rate NUMERIC,  -- Changé de taux_change à exchange_rate
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
        p.exchange_rate,  -- Changé de taux_change à exchange_rate
        p.date_paiement,
        p.methode::TEXT,
        p.notes,
        p.created_at,
        r.location_id,
        r.numero::TEXT AS room_numero,
        t.nom::TEXT AS tenant_nom,
        t.prenom::TEXT AS tenant_prenom
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