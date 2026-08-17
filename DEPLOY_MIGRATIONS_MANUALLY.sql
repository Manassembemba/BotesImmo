-- ============================================================================
-- INSTRUCTIONS POUR DÉPLOYER LES MIGRATIONS MANQUEES
-- ============================================================================
-- 
-- Copiez-collez ce fichier ENTIER dans Supabase Dashboard > SQL Editor
-- Exécutez-le en une seule fois
-- ============================================================================

-- ============================================================================
-- 1. SYSTÈME DE SYNCHRONISATION AMÉLIORÉ
-- ============================================================================

-- Table d'audit pour les transitions de statuts
CREATE TABLE IF NOT EXISTS public.room_status_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    transition_type TEXT NOT NULL DEFAULT 'AUTOMATIC',
    triggered_by UUID REFERENCES auth.users(id),
    booking_id UUID REFERENCES public.bookings(id),
    task_id UUID REFERENCES public.tasks(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_transition CHECK (previous_status != new_status)
);

CREATE INDEX IF NOT EXISTS idx_room_audit_room_id ON public.room_status_audit_log(room_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_created_at ON public.room_status_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_audit_booking_id ON public.room_status_audit_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_transition_type ON public.room_status_audit_log(transition_type);

-- Table de configuration
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

INSERT INTO public.room_sync_settings (setting_key, setting_value) VALUES
    ('checkout_time', '{"hour": 11, "minute": 0}'::jsonb),
    ('cleaning_duration_hours', '{"hours": 1}'::jsonb),
    ('auto_checkout_enabled', '{"enabled": true}'::jsonb),
    ('notification_enabled', '{"enabled": true}'::jsonb),
    ('timezone', '{"timezone": "Africa/Lubumbashi"}'::jsonb)
ON CONFLICT (location_id, setting_key) DO NOTHING;

-- Fonction de logging
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
        room_id, previous_status, new_status, transition_type,
        triggered_by, booking_id, task_id, reason, metadata
    ) VALUES (
        p_room_id, p_previous_status, p_new_status, p_transition_type,
        CASE WHEN p_transition_type = 'MANUAL' THEN auth.uid() ELSE NULL END,
        p_booking_id, p_task_id, p_reason, p_metadata
    );
END;
$$;

-- Fonction de notification
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
    SELECT numero INTO v_room_number FROM public.rooms WHERE id = p_room_id;
    
    v_notification_data := jsonb_build_object(
        'room_id', p_room_id, 'room_number', v_room_number,
        'new_status', p_new_status, 'previous_status', p_previous_status,
        'booking_id', p_booking_id, 'timestamp', NOW(),
        'timezone', 'Africa/Lubumbashi'
    );
    
    PERFORM pg_notify('room_status_changes', v_notification_data::text);
    
    PERFORM public.log_room_status_transition(
        p_room_id, p_previous_status, p_new_status,
        'AUTOMATIC', p_booking_id, NULL, 'Changement de statut automatique'
    );
END;
$$;

-- Fonction sync_room_statuses améliorée
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
    -- BOOKED → Occupé
    WITH updates_to_occupied AS (
        UPDATE public.rooms r SET status = 'Occupé', updated_at = v_current_time
        WHERE r.status = 'BOOKED' AND EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
            AND v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue
            AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_occupied;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- Occupé → PENDING_CHECKOUT
    WITH updates_to_pending_checkout AS (
        UPDATE public.rooms r SET status = 'PENDING_CHECKOUT', updated_at = v_current_time
        WHERE r.status = 'Occupé' AND EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
            AND v_current_time >= (b.date_fin_prevue - INTERVAL '2 hours')
            AND v_current_time < b.date_fin_prevue AND b.check_out_reel IS NULL
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_pending_checkout;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- PENDING_CHECKOUT/Occupé → A_NETTOYER
    WITH updates_to_cleaning AS (
        UPDATE public.rooms r SET status = 'A_NETTOYER', updated_at = v_current_time
        WHERE r.status IN ('Occupé', 'PENDING_CHECKOUT') AND EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
            AND (
                (v_current_time::time >= MAKE_TIME(v_checkout_hour, v_checkout_minute, 0) AND v_current_time::date >= b.date_fin_prevue::date)
                OR (v_current_time > b.date_fin_prevue)
            ) AND b.check_out_reel IS NULL
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_cleaning;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- A_NETTOYER → Libre
    WITH updates_to_free AS (
        UPDATE public.rooms r SET status = 'Libre', updated_at = v_current_time
        WHERE r.status = 'A_NETTOYER' AND EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.check_out_reel IS NOT NULL
            AND v_current_time >= (b.check_out_reel + INTERVAL '1 hour')
            AND b.status = 'COMPLETED'
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- Occupé → Libre (sécurité)
    WITH updates_to_free_orphan AS (
        UPDATE public.rooms r SET status = 'Libre', updated_at = v_current_time
        WHERE r.status = 'Occupé' AND NOT EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
            AND v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue
            AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_free_orphan;
    v_updated_count := v_updated_count + v_rows_affected;
    
    -- Libre/Nettoyage → Occupé
    WITH updates_to_busy AS (
        UPDATE public.rooms r SET status = 'Occupé', updated_at = v_current_time
        WHERE r.status IN ('Libre', 'Nettoyage', 'A_NETTOYER') AND EXISTS (
            SELECT 1 FROM public.bookings b WHERE b.room_id = r.id
            AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
            AND v_current_time >= b.date_debut_prevue AND v_current_time < b.date_fin_prevue
            AND (b.check_out_reel IS NULL OR b.check_out_reel > v_current_time)
        ) RETURNING 1
    )
    SELECT count(*) INTO v_rows_affected FROM updates_to_busy;
    v_updated_count := v_updated_count + v_rows_affected;
    
    RETURN v_updated_count;
END;
$$;

-- Trigger pour audit automatique
CREATE OR REPLACE FUNCTION public.track_room_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM public.log_room_status_transition(
            NEW.id, COALESCE(OLD.status, 'INITIAL'), NEW.status,
            'MANUAL', NULL, NULL, 'Changement manuel via interface'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_room_status_changes ON public.rooms;
CREATE TRIGGER trg_track_room_status_changes
AFTER UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.track_room_status_changes();

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates 
ON public.bookings(status, date_debut_prevue, date_fin_prevue)
WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT');

CREATE INDEX IF NOT EXISTS idx_rooms_status_location ON public.rooms(status, location_id);

-- Vues de supervision
CREATE OR REPLACE VIEW public.room_sync_dashboard AS
SELECT
    r.id AS room_id, r.numero AS room_number, r.status AS current_status,
    r.location_id, l.nom AS location_name,
    b.id AS current_booking_id, b.status AS booking_status,
    b.date_debut_prevue, b.date_fin_prevue, b.check_in_reel, b.check_out_reel,
    CASE WHEN b.check_out_reel IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'Africa/Lubumbashi' - b.check_out_reel)) / 3600
    ELSE NULL END AS hours_since_checkout,
    CASE WHEN b.date_fin_prevue IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (b.date_fin_prevue - (NOW() AT TIME ZONE 'Africa/Lubumbashi'))) / 3600
    ELSE NULL END AS hours_until_checkout,
    t.id AS current_task_id, t.type_tache AS task_type, t.status_tache AS task_status,
    (SELECT created_at FROM public.room_status_audit_log WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_transition_at,
    (SELECT new_status FROM public.room_status_audit_log WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_transition_to,
    (SELECT COUNT(*) FROM public.room_status_audit_log WHERE room_id = r.id AND created_at >= NOW() - INTERVAL '24 hours') AS transitions_last_24h
FROM public.rooms r
LEFT JOIN public.bookings b ON r.id = b.room_id 
    AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING_CHECKOUT')
    AND (NOW() AT TIME ZONE 'Africa/Lubumbashi') BETWEEN b.date_debut_prevue AND b.date_fin_prevue
LEFT JOIN public.locations l ON r.location_id = l.id
LEFT JOIN public.tasks t ON r.id = t.room_id AND t.status_tache IN ('TO_DO', 'IN_PROGRESS')
ORDER BY r.location_id, r.numero;

CREATE OR REPLACE VIEW public.room_transitions_recent AS
SELECT
    a.id, a.room_id, r.numero AS room_number,
    a.previous_status, a.new_status, a.transition_type, a.reason, a.created_at,
    b.tenant_id, t.prenom AS tenant_firstname, t.nom AS tenant_lastname,
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

-- Fonction de statistiques
CREATE OR REPLACE FUNCTION public.get_sync_statistics()
RETURNS TABLE (
    total_rooms INTEGER, rooms_synced INTEGER, pending_checkouts INTEGER,
    cleaning_in_progress INTEGER, transitions_24h INTEGER, last_sync TIMESTAMPTZ
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

-- Fonctions utilitaires
CREATE OR REPLACE FUNCTION public.send_realtime_notification(p_channel TEXT, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN PERFORM pg_notify(p_channel, p_payload::text); END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_time_lubumbashi()
RETURNS TIMESTAMPTZ LANGUAGE plpgsql AS $$
BEGIN RETURN NOW() AT TIME ZONE 'Africa/Lubumbashi'; END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.room_status_audit_log WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Permissions
GRANT SELECT ON public.room_status_audit_log TO authenticated;
GRANT INSERT ON public.room_status_audit_log TO authenticated;
GRANT SELECT ON public.room_sync_dashboard TO authenticated;
GRANT SELECT ON public.room_transitions_recent TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_room_status_transition TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_room_status_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_room_statuses TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sync_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_realtime_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_time_lubumbashi TO authenticated;

-- ============================================================================
-- 2. GESTION DES ERREURS ET CONFLITS
-- ============================================================================

-- Table des erreurs
CREATE TABLE IF NOT EXISTS public.sync_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    function_name TEXT NOT NULL,
    room_id UUID REFERENCES public.rooms(id),
    booking_id UUID REFERENCES public.bookings(id),
    user_id UUID REFERENCES auth.users(id),
    context JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'ERROR',
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_errors_type ON public.sync_error_log(error_type);
CREATE INDEX idx_sync_errors_severity ON public.sync_error_log(severity);
CREATE INDEX idx_sync_errors_created_at ON public.sync_error_log(created_at DESC);
CREATE INDEX idx_sync_errors_unresolved ON public.sync_error_log(is_resolved) WHERE is_resolved = false;

-- Table des conflits
CREATE TABLE IF NOT EXISTS public.booking_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id_1 UUID NOT NULL REFERENCES public.bookings(id),
    booking_id_2 UUID NOT NULL REFERENCES public.bookings(id),
    room_id UUID NOT NULL REFERENCES public.rooms(id),
    conflict_type TEXT NOT NULL,
    overlap_start TIMESTAMPTZ,
    overlap_end TIMESTAMPTZ,
    is_resolved BOOLEAN DEFAULT false,
    resolved_booking_id UUID,
    auto_resolved BOOLEAN DEFAULT false,
    resolution_method TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT different_bookings CHECK (booking_id_1 != booking_id_2)
);

CREATE INDEX idx_conflicts_room_id ON public.booking_conflicts(room_id);
CREATE INDEX idx_conflicts_unresolved ON public.booking_conflicts(is_resolved) WHERE is_resolved = false;

-- Fonction log_sync_error
CREATE OR REPLACE FUNCTION public.log_sync_error(
    p_error_type TEXT, p_error_message TEXT, p_function_name TEXT,
    p_room_id UUID DEFAULT NULL, p_booking_id UUID DEFAULT NULL,
    p_context JSONB DEFAULT '{}'::jsonb, p_severity TEXT DEFAULT 'ERROR',
    p_error_stack TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_error_id UUID;
BEGIN
    INSERT INTO public.sync_error_log (
        error_type, error_message, function_name, room_id, booking_id,
        user_id, context, severity, error_stack
    ) VALUES (
        p_error_type, p_error_message, p_function_name, p_room_id, p_booking_id,
        auth.uid(), p_context, p_severity, p_error_stack
    ) RETURNING id INTO v_error_id;
    
    IF p_severity = 'CRITICAL' THEN
        PERFORM pg_notify('sync_errors', jsonb_build_object(
            'error_id', v_error_id, 'type', p_error_type,
            'message', p_error_message, 'severity', p_severity, 'timestamp', NOW()
        )::text);
    END IF;
    
    RETURN v_error_id;
END;
$$;

-- Trigger pour détection des conflits
CREATE OR REPLACE FUNCTION public.check_booking_conflicts_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.bookings b
    WHERE b.room_id = NEW.room_id AND b.id != NEW.id
      AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND NEW.date_debut_prevue < b.date_fin_prevue
      AND NEW.date_fin_prevue > b.date_debut_prevue;
    
    IF v_conflict_count > 0 THEN
        INSERT INTO public.booking_conflicts (
            booking_id_1, booking_id_2, room_id, conflict_type,
            overlap_start, overlap_end
        )
        SELECT
            CASE WHEN b.id < NEW.id THEN b.id ELSE NEW.id END,
            CASE WHEN b.id < NEW.id THEN NEW.id ELSE b.id END,
            NEW.room_id, 'OVERLAP',
            GREATEST(NEW.date_debut_prevue, b.date_debut_prevue),
            LEAST(NEW.date_fin_prevue, b.date_fin_prevue)
        FROM public.bookings b
        WHERE b.room_id = NEW.room_id AND b.id != NEW.id
          AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
          AND NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
          AND NEW.date_debut_prevue < b.date_fin_prevue
          AND NEW.date_fin_prevue > b.date_debut_prevue;
        
        PERFORM public.log_sync_error(
            'CONFLICT', 'Conflit de réservation détecté lors de la création',
            'check_booking_conflicts_on_insert', NEW.room_id, NEW.id,
            jsonb_build_object('conflict_count', v_conflict_count, 'booking_status', NEW.status),
            'WARNING'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_booking_conflicts ON public.bookings;
CREATE TRIGGER trg_check_booking_conflicts
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.check_booking_conflicts_on_insert();

-- Vues
CREATE OR REPLACE VIEW public.sync_errors_dashboard AS
SELECT
    e.id, e.error_type, e.error_message, e.function_name, e.severity,
    e.is_resolved, e.created_at, r.numero AS room_number,
    b.invoice_number AS booking_reference,
    COUNT(*) OVER (PARTITION BY e.error_type) AS similar_errors_count,
    COUNT(*) OVER (PARTITION BY e.room_id) AS room_errors_count
FROM public.sync_error_log e
LEFT JOIN public.rooms r ON e.room_id = r.id
LEFT JOIN public.bookings b ON e.booking_id = b.id
ORDER BY e.created_at DESC;

CREATE OR REPLACE VIEW public.active_booking_conflicts AS
SELECT
    bc.id, bc.booking_id_1, bc.booking_id_2, bc.room_id,
    r.numero AS room_number, bc.conflict_type,
    bc.overlap_start, bc.overlap_end, bc.is_resolved, bc.created_at,
    b1.status AS booking_1_status, b2.status AS booking_2_status,
    b1.created_at AS booking_1_created, b2.created_at AS booking_2_created,
    EXTRACT(EPOCH FROM (LEAST(b1.date_fin_prevue, b2.date_fin_prevue) - GREATEST(b1.date_debut_prevue, b2.date_debut_prevue))) / 3600 AS overlap_hours
FROM public.booking_conflicts bc
JOIN public.rooms r ON bc.room_id = r.id
JOIN public.bookings b1 ON bc.booking_id_1 = b1.id
JOIN public.bookings b2 ON bc.booking_id_2 = b2.id
WHERE bc.is_resolved = false
ORDER BY bc.created_at DESC;

-- Permissions
GRANT SELECT ON public.sync_error_log TO authenticated;
GRANT INSERT ON public.sync_error_log TO authenticated;
GRANT UPDATE ON public.sync_error_log TO authenticated;
GRANT SELECT ON public.booking_conflicts TO authenticated;
GRANT INSERT ON public.booking_conflicts TO authenticated;
GRANT UPDATE ON public.booking_conflicts TO authenticated;
GRANT SELECT ON public.sync_errors_dashboard TO authenticated;
GRANT SELECT ON public.active_booking_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sync_error TO authenticated;

-- ============================================================================
-- FIN DU DÉPLOIEMENT
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Déploiement du système de synchronisation terminé avec succès!';
    RAISE NOTICE '✅ Tables créées: room_status_audit_log, room_sync_settings, sync_error_log, booking_conflicts';
    RAISE NOTICE '✅ Vues créées: room_sync_dashboard, room_transitions_recent, sync_errors_dashboard, active_booking_conflicts';
    RAISE NOTICE '✅ Fonctions créées: sync_room_statuses, get_sync_statistics, log_sync_error, etc.';
    RAISE NOTICE '✅ Triggers créés: trg_track_room_status_changes, trg_check_booking_conflicts';
END $$;
