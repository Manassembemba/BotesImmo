-- Migration: Optimize get_tenants_with_stats with LEFT JOIN, multi-site fallback, and total_spent calculation

DROP FUNCTION IF EXISTS public.get_tenants_with_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_tenants_with_stats(p_location_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid,
    nom text,
    prenom text,
    telephone text,
    email text,
    id_document text,
    notes text,
    liste_noire boolean,
    location_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    booking_count bigint,
    total_spent numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
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
        COUNT(b.id)::BIGINT AS booking_count,
        COALESCE(SUM(CASE WHEN b.status NOT IN ('CANCELLED') THEN b.prix_total ELSE 0 END), 0)::NUMERIC AS total_spent
    FROM
        public.tenants t
    LEFT JOIN
        public.bookings b ON b.tenant_id = t.id
    WHERE
        (p_location_id IS NULL OR t.location_id = p_location_id OR t.location_id IS NULL)
    GROUP BY
        t.id, t.nom, t.prenom, t.telephone, t.email, t.id_document, t.notes, t.liste_noire, t.location_id, t.created_at, t.updated_at
    ORDER BY
        t.created_at DESC;
END;
$function$;
