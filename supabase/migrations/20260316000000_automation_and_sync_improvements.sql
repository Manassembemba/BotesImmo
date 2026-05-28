-- 1. Amélioration de la fonction de synchronisation des statuts
CREATE OR REPLACE FUNCTION public.sync_room_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_rows_affected INTEGER;
BEGIN
    -- Transition : Chambre marquée 'Occupé' mais AUCUNE réservation active (Confirmée ou En cours)
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
                -- On inclut IN_PROGRESS et PENDING_CHECKOUT qui sont les vrais marqueurs d'occupation physique
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
                AND NOW() >= b.date_debut_prevue
                AND NOW() < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > NOW())
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- Transition : Chambre marquée 'Libre' ou 'Nettoyage' alors qu'il y a une réservation active
    -- On la passe à 'Occupé'
    WITH updates_to_busy AS (
        UPDATE public.rooms r
        SET 
            status = 'Occupé', 
            updated_at = NOW()
        WHERE 
            r.status IN ('Libre', 'Nettoyage', 'Libre', 'A_NETTOYER')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                -- Important : Une réservation PENDING (En attente) ne doit pas marquer la chambre comme Occupé
                -- Seules les réservations confirmées ou déjà commencées comptent.
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
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

-- 2. Automatisation en temps réel via Triggers
-- Cette fonction sera appelée à chaque modification de réservation
CREATE OR REPLACE FUNCTION public.handle_booking_sync_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.sync_room_statuses();
    RETURN NULL; -- Trigger AFTER, le retour n'impacte pas l'opération
END;
$$;

-- Suppression du trigger s'il existe déjà pour éviter les doublons au déploiement
DROP TRIGGER IF EXISTS trg_sync_rooms_on_booking_change ON public.bookings;

-- Création du trigger sur la table bookings
CREATE TRIGGER trg_sync_rooms_on_booking_change
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH STATEMENT
EXECUTE FUNCTION public.handle_booking_sync_on_change();

-- 3. Planification des tâches de fond via pg_cron
-- Note : L'extension pg_cron doit être activée dans l'interface Supabase (Database -> Extensions)
-- ou via SQL par un superutilisateur.

-- Activation de l'extension (si possible)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Planification de la synchronisation des statuts toutes les heures
-- Cela rattrape les changements d'état liés uniquement au passage du temps (sans action manuelle)
SELECT cron.schedule('sync-room-statuses-hourly', '0 * * * *', 'SELECT public.sync_room_statuses()');

-- Planification des transitions quotidiennes (Nettoyage automatique après 11h)
SELECT cron.schedule('daily-room-transitions-hourly', '5 * * * *', 'SELECT public.process_daily_room_transitions()');
