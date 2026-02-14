-- Fonction pour synchroniser les statuts des chambres avec les réservations actives
CREATE OR REPLACE FUNCTION public.sync_room_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_rows_affected INTEGER;
BEGIN
    -- 1. Cas : Chambre marquée 'Occupé' mais AUCUNE réservation active
    -- On la passe à 'Libre'
    WITH updates_to_free AS (
        UPDATE public.rooms r
        SET 
            status = 'Libre', 
            updated_at = NOW()
        WHERE 
            r.status = 'Occupé'
            AND NOT EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'PENDING')
                -- La réservation couvre "maintenant"
                AND NOW() >= b.date_debut_prevue
                AND NOW() < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > NOW())
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- 2. Cas : Chambre marquée 'Libre' ou 'Nettoyage' ALORS qu'il y a une réservation active
    -- On la passe à 'Occupé'
    WITH updates_to_busy AS (
        UPDATE public.rooms r
        SET 
            status = 'Occupé', 
            updated_at = NOW()
        WHERE 
            r.status IN ('Libre', 'Nettoyage')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'PENDING')
                -- La réservation couvre "maintenant"
                AND NOW() >= b.date_debut_prevue
                AND NOW() < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > NOW())
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_busy;
    v_updated_count := v_updated_count + v_rows_affected;

    RETURN v_updated_count;
END;
$$;
