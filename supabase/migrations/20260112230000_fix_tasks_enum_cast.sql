-- Recréation de la fonction get_tasks avec les casts corrects pour les types énumérés
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
    -- RLS is enforced on the joined rooms table.
    -- Non-admins will only see rooms (and thus tasks for those rooms) from their location.
    -- Admins will see all if p_location_id is null, or filtered if it's provided.
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