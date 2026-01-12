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

-- Also, let's add RLS to the tasks table for non-admins as a security measure.
-- This ensures that even if someone calls the table directly, they can't see tasks
-- from other locations unless they are an admin.

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admins can see all tasks
CREATE POLICY "Allow admin to see all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

-- Users can only see tasks for rooms in their own location
CREATE POLICY "Allow users to see tasks for their location"
ON public.tasks
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.rooms r
        WHERE r.id = tasks.room_id
          AND r.location_id = (
            SELECT location_id
            FROM public.profiles
            WHERE user_id = auth.uid()
          )
    )
    OR public.has_role('ADMIN', auth.uid())
);

-- For INSERT, UPDATE, DELETE, let's assume for now only admins or a system role can do it.
-- Let's add basic policies for now.
CREATE POLICY "Allow admin to insert tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('ADMIN', auth.uid()));

CREATE POLICY "Allow admin to update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));

CREATE POLICY "Allow admin to delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.has_role('ADMIN', auth.uid()));
