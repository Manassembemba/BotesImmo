-- ============================================================================
-- SYSTÈME DE SYNCHRONISATION AMÉLIORÉ ET AUTOMATISÉ
-- Migration: 20260324000000_enhanced_room_sync_system.sql
-- Description: Audit logging, automation améliorée, timezone support, notifications
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURATION DU TIMEZONE (Africa/Lubumbashi - RDC)
-- ============================================================================

-- Définir le timezone par défaut pour la session
SET timezone = 'Africa/Lubumbashi';

-- ============================================================================
-- 2. TABLE D'AUDIT POUR LES TRANSITIONS DE STATUTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.room_status_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    transition_type TEXT NOT NULL DEFAULT 'AUTOMATIC', -- 'MANUAL', 'AUTOMATIC', 'TRIGGER', 'CRON'
    triggered_by UUID REFERENCES auth.users(id), -- User qui a déclenché (si manuel)
    booking_id UUID REFERENCES public.bookings(id), -- Réservation associée si applicable
    task_id UUID REFERENCES public.tasks(id), -- Tâche associée si applicable
    reason TEXT, -- Raison de la transition
    metadata JSONB DEFAULT '{}'::jsonb, -- Données additionnelles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_transition CHECK (
        previous_status != new_status
    )
);

-- Index pour performances de requêtage
CREATE INDEX idx_room_audit_room_id ON public.room_status_audit_log(room_id);
CREATE INDEX idx_room_audit_created_at ON public.room_status_audit_log(created_at DESC);
CREATE INDEX idx_room_audit_booking_id ON public.room_status_audit_log(booking_id);
CREATE INDEX idx_room_audit_transition_type ON public.room_status_audit_log(transition_type);

-- Commentaire
COMMENT ON TABLE public.room_status_audit_log IS 'Audit log de toutes les transitions de statuts de chambres';

-- ============================================================================
-- 3. TABLE DE CONFIGURATION DES RÈGLES DE SYNCHRONISATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.room_sync_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(location_id, setting_key)
);

-- Insertion des paramètres par défaut
INSERT INTO public.room_sync_settings (setting_key, setting_value) VALUES
    ('checkout_time', '{"hour": 11, "minute": 0}'::jsonb),
    ('cleaning_duration_hours', '{"hours": 1}'::jsonb),
    ('auto_checkout_enabled', '{"enabled": true}'::jsonb),
    ('notification_enabled', '{"enabled": true}'::jsonb),
    ('timezone', '{"timezone": "Africa/Lubumbashi"}'::jsonb)
ON CONFLICT (location_id, setting_key) DO NOTHING;

-- ============================================================================
-- 4. FONCTION D'AUDIT LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_room_status_transition(
    p_room_id UUID,
    p_previous_status TEXT,
    p_new_status TEXT,
    p_transition_type TEXT DEFAULT 'AUTOMATIC',
    p_booking_id UUID DEFAULT NULL,
    p_task_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.room_status_audit_log (
        room_id,
        previous_status,
        new_status,
        transition_type,
        triggered_by,
        booking_id,
        task_id,
        reason,
        metadata
    ) VALUES (
        p_room_id,
        p_previous_status,
        p_new_status,
        p_transition_type,
        CASE WHEN p_transition_type = 'MANUAL' THEN auth.uid() ELSE NULL END,
        p_booking_id,
        p_task_id,
        p_reason,
        p_metadata
    );
END;
$$;

COMMENT ON FUNCTION public.log_room_status_transition IS 'Enregistre une transition de statut dans le journal d''audit';

-- ============================================================================
-- 5. FONCTION DE NOTIFICATION (pour futures intégrations WebSocket/Email)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_room_status_change(
    p_room_id UUID,
    p_new_status TEXT,
    p_previous_status TEXT,
    p_booking_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room_number TEXT;
    v_notification_data JSONB;
BEGIN
    -- Récupérer le numéro de chambre
    SELECT numero INTO v_room_number FROM public.rooms WHERE id = p_room_id;
    
    -- Créer les données de notification
    v_notification_data := jsonb_build_object(
        'room_id', p_room_id,
        'room_number', v_room_number,
        'new_status', p_new_status,
        'previous_status', p_previous_status,
        'booking_id', p_booking_id,
        'timestamp', NOW(),
        'timezone', 'Africa/Lubumbashi'
    );
    
    -- Utiliser pg_notify pour les notifications en temps réel (WebSocket)
    PERFORM pg_notify(
        'room_status_changes',
        v_notification_data::text
    );
    
    -- TODO: Intégrer avec un service d'email/SMS si nécessaire
    -- Pour l'instant, on logge juste dans l'audit
    PERFORM public.log_room_status_transition(
        p_room_id,
        p_previous_status,
        p_new_status,
        'AUTOMATIC',
        p_booking_id,
        NULL,
        'Changement de statut automatique'
    );
END;
$$;

COMMENT ON FUNCTION public.notify_room_status_change IS 'Envie une notification lors d''un changement de statut';

-- ============================================================================
-- 6. VERSION AMÉLIORÉE DE sync_room_statuses()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_room_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_rows_affected INTEGER;
    v_current_time TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Lubumbashi';
    v_checkout_hour INTEGER := 11;
    v_checkout_minute INTEGER := 0;
BEGIN
    -- Récupérer les paramètres de configuration
    SELECT 
        (setting_value->>'hour')::INTEGER,
        (setting_value->>'minute')::INTEGER
    INTO v_checkout_hour, v_checkout_minute
    FROM public.room_sync_settings
    WHERE setting_key = 'checkout_time'
    LIMIT 1;
    
    -- ========================================================================
    -- Cas 1: BOOKED → Occupé (début de réservation atteint)
    -- ========================================================================
    WITH updates_to_occupied AS (
        UPDATE public.rooms r
        SET
            status = 'Occupé',
            updated_at = v_current_time
        WHERE
            r.status = 'BOOKED'
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
                AND v_current_time >= b.date_debut_prevue
                AND v_current_time < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_occupied;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- ========================================================================
    -- Cas 2: Occupé → PENDING_CHECKOUT (proche de la fin de réservation)
    -- Dans les 2 heures avant la fin prévue
    -- ========================================================================
    WITH updates_to_pending_checkout AS (
        UPDATE public.rooms r
        SET
            status = 'PENDING_CHECKOUT',
            updated_at = v_current_time
        WHERE
            r.status = 'Occupé'
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
                AND v_current_time >= (b.date_fin_prevue - INTERVAL '2 hours')
                AND v_current_time < b.date_fin_prevue
                AND b.check_out_reel IS NULL
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_pending_checkout;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- ========================================================================
    -- Cas 3: PENDING_CHECKOUT/Occupé → A_NETTOYER (check-out dépassé)
    -- ========================================================================
    WITH updates_to_cleaning AS (
        UPDATE public.rooms r
        SET
            status = 'A_NETTOYER',
            updated_at = v_current_time
        WHERE
            r.status IN ('Occupé', 'PENDING_CHECKOUT')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
                AND (
                    -- Heure de check-out dépassée (11h)
                    (v_current_time::time >= MAKE_TIME(v_checkout_hour, v_checkout_minute, 0)
                    AND v_current_time::date >= b.date_fin_prevue::date)
                    OR
                    -- OU date de fin dépassée
                    (v_current_time > b.date_fin_prevue)
                )
                AND b.check_out_reel IS NULL
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_cleaning;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- Logger les transitions
    INSERT INTO public.room_status_audit_log (room_id, previous_status, new_status, transition_type, reason)
    SELECT 
        r.id,
        CASE 
            WHEN r.status = 'BOOKED' THEN 'BOOKED'
            WHEN r.status = 'Occupé' THEN 'Occupé'
            WHEN r.status = 'PENDING_CHECKOUT' THEN 'PENDING_CHECKOUT'
            ELSE r.status
        END,
        'A_NETTOYER',
        'CRON',
        'Check-out automatique - Heure de départ dépassée'
    FROM public.rooms r
    WHERE r.status = 'A_NETTOYER'
    AND r.updated_at >= v_current_time - INTERVAL '1 minute';
    
    -- ========================================================================
    -- Cas 4: A_NETTOYER → Libre (nettoyage terminé - 1h après)
    -- ========================================================================
    WITH updates_to_free AS (
        UPDATE public.rooms r
        SET
            status = 'Libre',
            updated_at = v_current_time
        WHERE
            r.status = 'A_NETTOYER'
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.check_out_reel IS NOT NULL
                AND v_current_time >= (b.check_out_reel + INTERVAL '1 hour')
                AND b.status = 'COMPLETED'
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- ========================================================================
    -- Cas 5: Occupé → Libre (aucune réservation active - sécurité)
    -- ========================================================================
    WITH updates_to_free_orphan AS (
        UPDATE public.rooms r
        SET
            status = 'Libre',
            updated_at = v_current_time
        WHERE
            r.status = 'Occupé'
            AND NOT EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
                AND v_current_time >= b.date_debut_prevue
                AND v_current_time < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free_orphan;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- ========================================================================
    -- Cas 6: Libre/Nettoyage → Occupé (réservation active détectée)
    -- ========================================================================
    WITH updates_to_busy AS (
        UPDATE public.rooms r
        SET
            status = 'Occupé',
            updated_at = v_current_time
        WHERE
            r.status IN ('Libre', 'Nettoyage', 'A_NETTOYER')
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
                AND v_current_time >= b.date_debut_prevue
                AND v_current_time < b.date_fin_prevue
                AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
            )
        RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_busy;
    v_updated_count := v_updated_count + v_rows_affected;
    
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.sync_room_statuses IS 'Synchronise les statuts des chambres avec les réservations (version améliorée avec timezone et audit)';

-- ============================================================================
-- 7. TRIGGER POUR AUDIT AUTOMATIQUE DES CHANGEMENTS DE STATUT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_room_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Seulement si le statut change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM public.log_room_status_transition(
            NEW.id,
            COALESCE(OLD.status, 'INITIAL'),
            NEW.status,
            'MANUAL',
            NULL,
            NULL,
            'Changement manuel via interface'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.track_room_status_changes IS 'Track les changements de statut des chambres pour l''audit';

-- Suppression du trigger s'il existe
DROP TRIGGER IF EXISTS trg_track_room_status_changes ON public.rooms;

-- Création du trigger
CREATE TRIGGER trg_track_room_status_changes
AFTER UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.track_room_status_changes();

-- ============================================================================
-- 8. INDEX DE PERFORMANCE
-- ============================================================================

-- Index pour les requêtes de synchronisation
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates 
ON public.bookings(status, date_debut_prevue, date_fin_prevue)
WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT');

CREATE INDEX IF NOT EXISTS idx_bookings_checkout_reel 
ON public.bookings(check_out_reel)
WHERE check_out_reel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_status_location 
ON public.rooms(status, location_id);

-- ============================================================================
-- 9. VUE DE SUPERVISION DES SYNCHRONISATIONS
-- ============================================================================

CREATE OR REPLACE VIEW public.room_sync_dashboard AS
SELECT
    r.id AS room_id,
    r.numero AS room_number,
    r.status AS current_status,
    r.location_id,
    l.nom AS location_name,
    -- Réservation actuelle
    b.id AS current_booking_id,
    b.status AS booking_status,
    b.date_debut_prevue,
    b.date_fin_prevue,
    b.check_in_reel,
    b.check_out_reel,
    -- Calculs
    CASE 
        WHEN b.check_out_reel IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'Africa/Lubumbashi' - b.check_out_reel)) / 3600
        ELSE NULL
    END AS hours_since_checkout,
    CASE 
        WHEN b.date_fin_prevue IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (b.date_fin_prevue - (NOW() AT TIME ZONE 'Africa/Lubumbashi'))) / 3600
        ELSE NULL
    END AS hours_until_checkout,
    -- Tâches en cours
    t.id AS current_task_id,
    t.type_tache AS task_type,
    t.status_tache AS task_status,
    -- Dernière transition
    (SELECT created_at FROM public.room_status_audit_log WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_transition_at,
    (SELECT new_status FROM public.room_status_audit_log WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_transition_to,
    -- Statistiques
    (SELECT COUNT(*) FROM public.room_status_audit_log WHERE room_id = r.id AND created_at >= NOW() - INTERVAL '24 hours') AS transitions_last_24h
FROM public.rooms r
LEFT JOIN public.bookings b ON r.id = b.room_id 
    AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
    AND (NOW() AT TIME ZONE 'Africa/Lubumbashi') BETWEEN b.date_debut_prevue AND b.date_fin_prevue
LEFT JOIN public.locations l ON r.location_id = l.id
LEFT JOIN public.tasks t ON r.id = t.room_id 
    AND t.status_tache IN ('TO_DO', 'IN_PROGRESS')
ORDER BY r.location_id, r.numero;

COMMENT ON VIEW public.room_sync_dashboard IS 'Vue de supervision en temps réel des statuts et synchronisations';

-- ============================================================================
-- 10. VUE DES TRANSITIONS RÉCENTES
-- ============================================================================

CREATE OR REPLACE VIEW public.room_transitions_recent AS
SELECT
    a.id,
    a.room_id,
    r.numero AS room_number,
    a.previous_status,
    a.new_status,
    a.transition_type,
    a.reason,
    a.created_at,
    -- Informations complémentaires
    b.tenant_id,
    t.prenom AS tenant_firstname,
    t.nom AS tenant_lastname,
    -- Agent qui a effectué l'action
    CASE 
        WHEN a.transition_type = 'MANUAL' THEN 'Utilisateur'
        WHEN a.transition_type = 'CRON' THEN 'Automatique (Cron)'
        WHEN a.transition_type = 'TRIGGER' THEN 'Automatique (Trigger)'
        ELSE 'Système'
    END AS triggered_by_label
FROM public.room_status_audit_log a
LEFT JOIN public.rooms r ON a.room_id = r.id
LEFT JOIN public.bookings b ON a.booking_id = b.id
LEFT JOIN public.tenants t ON b.tenant_id = t.id
ORDER BY a.created_at DESC
LIMIT 100;

COMMENT ON VIEW public.room_transitions_recent IS 'Historique des 100 dernières transitions de statuts';

-- ============================================================================
-- 11. FONCTION DE NETTOYAGE DES ANCIENS LOGS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.room_status_audit_log
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Supprime les anciens logs d''audit (par défaut 90 jours)';

-- ============================================================================
-- 12. PLANIFICATION pg_cron AMÉLIORÉE
-- ============================================================================

-- Nettoyer les anciennes planifications
DO $$
BEGIN
    -- Supprimer les anciennes tâches si elles existent
    PERFORM cron.unschedule('sync-room-statuses-hourly');
    PERFORM cron.unschedule('daily-room-transitions-hourly');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Nouvelle planification avec fréquence accrue
-- Synchronisation toutes les 15 minutes (au lieu de 1 heure)
SELECT cron.schedule(
    'sync-room-statuses-quarter-hour',
    '*/15 * * * *',
    'SELECT public.sync_room_statuses()'
);

-- Check-out automatique toutes les heures à partir de 11h
SELECT cron.schedule(
    'auto-checkout-processor',
    '0 11-23 * * *',
    'SELECT public.process_daily_room_transitions()'
);

-- Nettoyage des logs anciens une fois par semaine (dimanche à 3h)
SELECT cron.schedule(
    'cleanup-audit-logs-weekly',
    '0 3 * * 0',
    'SELECT public.cleanup_old_audit_logs(90)'
);

-- ============================================================================
-- 13. DONNÉES DE DÉMONSTRATION (optionnel - pour test)
-- ============================================================================

-- Insertion d'un paramètre de débuggage
INSERT INTO public.room_sync_settings (setting_key, setting_value) 
VALUES ('debug_mode', '{"enabled": false, "log_level": "INFO"}'::jsonb)
ON CONFLICT (location_id, setting_key) DO NOTHING;

-- ============================================================================
-- 14. FONCTION DE STATISTIQUES DE SYNCHRONISATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sync_statistics()
RETURNS TABLE (
    total_rooms INTEGER,
    rooms_synced INTEGER,
    pending_checkouts INTEGER,
    cleaning_in_progress INTEGER,
    transitions_24h INTEGER,
    last_sync TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.rooms)::INTEGER AS total_rooms,
        (SELECT COUNT(*) FROM public.rooms WHERE status IN ('Occupé', 'A_NETTOYER', 'PENDING_CHECKOUT'))::INTEGER AS rooms_synced,
        (SELECT COUNT(*) FROM public.bookings WHERE status = 'PENDING_CHECKOUT')::INTEGER AS pending_checkouts,
        (SELECT COUNT(*) FROM public.tasks WHERE status_tache IN ('TO_DO', 'IN_PROGRESS') AND type_tache = 'NETTOYAGE')::INTEGER AS cleaning_in_progress,
        (SELECT COUNT(*) FROM public.room_status_audit_log WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS transitions_24h,
        (SELECT MAX(created_at) FROM public.room_status_audit_log) AS last_sync;
END;
$$;

COMMENT ON FUNCTION public.get_sync_statistics IS 'Retourne les statistiques de synchronisation en temps réel';

-- ============================================================================
-- 15. FONCTION POUR NOTIFICATIONS EN TEMPS RÉEL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_realtime_notification(
    p_channel TEXT,
    p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM pg_notify(p_channel, p_payload::text);
END;
$$;

COMMENT ON FUNCTION public.send_realtime_notification IS 'Envie une notification en temps réel via pg_notify';

-- ============================================================================
-- 16. FONCTION POUR OBTENIR L'HEURE LOCALE (Lubumbashi)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_time_lubumbashi()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Africa/Lubumbashi';
END;
$$;

COMMENT ON FUNCTION public.get_current_time_lubumbashi IS 'Retourne l'heure actuelle dans le timezone Africa/Lubumbashi';

-- ============================================================================
-- 17. PERMISSIONS
-- ============================================================================

-- Permissions sur la table d'audit
GRANT SELECT ON public.room_status_audit_log TO authenticated;
GRANT INSERT ON public.room_status_audit_log TO authenticated;
GRANT SELECT ON public.room_sync_dashboard TO authenticated;
GRANT SELECT ON public.room_transitions_recent TO authenticated;

-- Permissions sur les fonctions
GRANT EXECUTE ON FUNCTION public.log_room_status_transition TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_room_status_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_room_statuses TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sync_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_realtime_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_time_lubumbashi TO authenticated;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Migration du système de synchronisation terminée avec succès!';
    RAISE NOTICE '- Table d''audit créée: room_status_audit_log';
    RAISE NOTICE '- Fonction sync_room_statuses() améliorée avec timezone Africa/Lubumbashi';
    RAISE NOTICE '- Trigger d''audit automatique créé';
    RAISE NOTICE '- Vues de supervision créées: room_sync_dashboard, room_transitions_recent';
    RAISE NOTICE '- Planifications pg_cron configurées (toutes les 15 minutes)';
    RAISE NOTICE '- Index de performance ajoutés';
END $$;
