-- This migration fixes a return type mismatch in the get_tenants_with_stats RPC.
-- Several columns in the 'tenants' table are of type character varying, but the function
-- expected TEXT. This adds the explicit ::TEXT cast to all relevant columns to solve the error.

CREATE OR REPLACE FUNCTION get_tenants_with_stats(
    p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nom TEXT,
    prenom TEXT,
    telephone TEXT,
    email TEXT,
    id_document TEXT,
    notes TEXT,
    liste_noire BOOLEAN,
    location_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    booking_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.nom::TEXT,
        t.prenom::TEXT,
        t.telephone::TEXT,
        t.email::TEXT,
        t.id_document::TEXT,
        t.notes::TEXT,
        t.liste_noire,
        t.location_id,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM public.bookings b WHERE b.tenant_id = t.id) AS booking_count
    FROM
        public.tenants t
    WHERE
        (p_location_id IS NULL OR t.location_id = p_location_id);
END;
$$;
