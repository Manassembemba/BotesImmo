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
    -- RLS is enforced on tenants table.
    -- Non-admins will only see tenants from their own location.
    -- Admins will see all if p_location_id is null, or filtered if it's provided.
    RETURN QUERY
    SELECT
        t.id,
        t.nom,
        t.prenom,
        t.telephone,
        t.email,
        t.id_document,
        t.notes,
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
