-- ============================================================================
-- GESTION DES CONFLITS ET ERREURS DE SYNCHRONISATION
-- Migration: 20260324010000_sync_error_handling.sql
-- ============================================================================

-- ============================================================================
-- 1. TABLE DE JOURNALISATION DES ERREURS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL, -- 'CONFLICT', 'TIMEOUT', 'DATABASE', 'VALIDATION', 'UNKNOWN'
    error_message TEXT NOT NULL,
    error_stack TEXT,
    function_name TEXT NOT NULL, -- Fonction où l'erreur s'est produite
    room_id UUID REFERENCES public.rooms(id),
    booking_id UUID REFERENCES public.bookings(id),
    user_id UUID REFERENCES auth.users(id),
    context JSONB DEFAULT '{}'::jsonb, -- Données contextuelles pour débogage
    severity TEXT DEFAULT 'ERROR', -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtage efficace
CREATE INDEX idx_sync_errors_type ON public.sync_error_log(error_type);
CREATE INDEX idx_sync_errors_severity ON public.sync_error_log(severity);
CREATE INDEX idx_sync_errors_created_at ON public.sync_error_log(created_at DESC);
CREATE INDEX idx_sync_errors_unresolved ON public.sync_error_log(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_sync_errors_room_id ON public.sync_error_log(room_id);
CREATE INDEX idx_sync_errors_booking_id ON public.sync_error_log(booking_id);

COMMENT ON TABLE public.sync_error_log IS 'Journal des erreurs de synchronisation et conflits';

-- ============================================================================
-- 2. TABLE DE GESTION DES CONFLITS DE RÉSERVATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id_1 UUID NOT NULL REFERENCES public.bookings(id),
    booking_id_2 UUID NOT NULL REFERENCES public.bookings(id),
    room_id UUID NOT NULL REFERENCES public.rooms(id),
    conflict_type TEXT NOT NULL, -- 'OVERLAP', 'DOUBLE_BOOKING', 'STATUS_MISMATCH'
    overlap_start TIMESTAMPTZ,
    overlap_end TIMESTAMPTZ,
    is_resolved BOOLEAN DEFAULT false,
    resolved_booking_id UUID, -- La réservation qui a été conservée
    auto_resolved BOOLEAN DEFAULT false,
    resolution_method TEXT, -- 'CANCEL_NEWEST', 'CANCEL_OLDEST', 'MANUAL'
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT different_bookings CHECK (booking_id_1 != booking_id_2)
);

CREATE INDEX idx_conflicts_room_id ON public.booking_conflicts(room_id);
CREATE INDEX idx_conflicts_unresolved ON public.booking_conflicts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_conflicts_created_at ON public.booking_conflicts(created_at DESC);

COMMENT ON TABLE public.booking_conflicts IS 'Gestion des conflits de réservations (chevauchements)';

-- ============================================================================
-- 3. FONCTION DE LOG D'ERREUR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_sync_error(
    p_error_type TEXT,
    p_error_message TEXT,
    p_function_name TEXT,
    p_room_id UUID DEFAULT NULL,
    p_booking_id UUID DEFAULT NULL,
    p_context JSONB DEFAULT '{}'::jsonb,
    p_severity TEXT DEFAULT 'ERROR',
    p_error_stack TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO public.sync_error_log (
        error_type,
        error_message,
        function_name,
        room_id,
        booking_id,
        user_id,
        context,
        severity,
        error_stack
    ) VALUES (
        p_error_type,
        p_error_message,
        p_function_name,
        p_room_id,
        p_booking_id,
        auth.uid(),
        p_context,
        p_severity,
        p_error_stack
    ) RETURNING id INTO v_error_id;
    
    -- Notification pour les erreurs critiques
    IF p_severity = 'CRITICAL' THEN
        PERFORM pg_notify(
            'sync_errors',
            jsonb_build_object(
                'error_id', v_error_id,
                'type', p_error_type,
                'message', p_error_message,
                'severity', p_severity,
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN v_error_id;
END;
$$;

COMMENT ON FUNCTION public.log_sync_error IS 'Enregistre une erreur de synchronisation';

-- ============================================================================
-- 4. FONCTION DE DÉTECTION DES CONFLITS DE RÉSERVATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_booking_conflicts()
RETURNS TABLE (
    conflict_id UUID,
    booking_1_id UUID,
    booking_2_id UUID,
    room_id UUID,
    room_number TEXT,
    overlap_start TIMESTAMPTZ,
    overlap_end TIMESTAMPTZ,
    severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(
            (SELECT id FROM public.booking_conflicts 
             WHERE booking_id_1 = b1.id AND booking_id_2 = b2.id 
             LIMIT 1),
        gen_random_uuid()) AS conflict_id,
        b1.id AS booking_1_id,
        b2.id AS booking_2_id,
        b1.room_id,
        r.numero AS room_number,
        GREATEST(b1.date_debut_prevue, b2.date_debut_prevue) AS overlap_start,
        LEAST(b1.date_fin_prevue, b2.date_fin_prevue) AS overlap_end,
        CASE
            WHEN b1.status = 'CONFIRMED' AND b2.status = 'CONFIRMED' THEN 'CRITICAL'
            WHEN b1.status IN ('CONFIRMED', 'IN_PROGRESS') OR b2.status IN ('CONFIRMED', 'IN_PROGRESS') THEN 'HIGH'
            ELSE 'MEDIUM'
        END AS severity
    FROM public.bookings b1
    JOIN public.bookings b2 ON b1.room_id = b2.room_id AND b1.id < b2.id
    JOIN public.rooms r ON b1.room_id = r.id
    WHERE b1.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND b2.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND b1.date_debut_prevue < b2.date_fin_prevue
      AND b1.date_fin_prevue > b2.date_debut_prevue
      AND NOT EXISTS (
          SELECT 1 FROM public.booking_conflicts bc
          WHERE (bc.booking_id_1 = b1.id AND bc.booking_id_2 = b2.id)
             OR (bc.booking_id_1 = b2.id AND bc.booking_id_2 = b1.id)
      );
END;
$$;

COMMENT ON FUNCTION public.detect_booking_conflicts IS 'Détecte les conflits de réservations (chevauchements)';

-- ============================================================================
-- 5. FONCTION DE RÉSOLUTION AUTOMATIQUE DES CONFLITS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_booking_conflict(
    p_conflict_id UUID,
    p_resolution_method TEXT DEFAULT 'CANCEL_NEWEST',
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conflict RECORD;
    v_booking_to_cancel UUID;
    v_result BOOLEAN;
BEGIN
    -- Récupérer le conflit
    SELECT * INTO v_conflict
    FROM public.booking_conflicts
    WHERE id = p_conflict_id AND is_resolved = false;
    
    IF v_conflict IS NULL THEN
        RAISE EXCEPTION 'Conflit non trouvé ou déjà résolu';
    END IF;
    
    -- Déterminer quelle réservation annuler
    IF p_resolution_method = 'CANCEL_NEWEST' THEN
        -- Annuler la plus récente
        SELECT id INTO v_booking_to_cancel
        FROM public.bookings
        WHERE id IN (v_conflict.booking_id_1, v_conflict.booking_id_2)
        ORDER BY created_at DESC
        LIMIT 1;
    ELSIF p_resolution_method = 'CANCEL_OLDEST' THEN
        -- Annuler la plus ancienne
        SELECT id INTO v_booking_to_cancel
        FROM public.bookings
        WHERE id IN (v_conflict.booking_id_1, v_conflict.booking_id_2)
        ORDER BY created_at ASC
        LIMIT 1;
    ELSE
        RAISE EXCEPTION 'Méthode de résolution inconnue: %', p_resolution_method;
    END IF;
    
    -- Annuler la réservation
    UPDATE public.bookings
    SET status = 'CANCELLED',
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' [Annulée automatiquement - Conflit de réservation ID: ' || p_conflict_id || ']'
    WHERE id = v_booking_to_cancel;
    
    -- Marquer le conflit comme résolu
    UPDATE public.booking_conflicts
    SET is_resolved = true,
        resolved_booking_id = v_booking_to_cancel,
        resolved_at = NOW(),
        resolved_by = p_user_id,
        resolution_method = p_resolution_method,
        auto_resolved = true
    WHERE id = p_conflict_id;
    
    -- Synchroniser les statuts de chambre
    PERFORM public.sync_room_statuses();
    
    -- Logger l'action
    PERFORM public.log_sync_error(
        'CONFLICT_RESOLUTION',
        'Conflit de réservation résolu automatiquement',
        'resolve_booking_conflict',
        v_conflict.room_id,
        v_booking_to_cancel,
        jsonb_build_object(
            'conflict_id', p_conflict_id,
            'method', p_resolution_method,
            'cancelled_booking', v_booking_to_cancel
        ),
        'INFO'
    );
    
    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.resolve_booking_conflict IS 'Résout automatiquement un conflit de réservation';

-- ============================================================================
-- 6. VUE DE SUPERVISION DES ERREURS
-- ============================================================================

CREATE OR REPLACE VIEW public.sync_errors_dashboard AS
SELECT
    e.id,
    e.error_type,
    e.error_message,
    e.function_name,
    e.severity,
    e.is_resolved,
    e.created_at,
    -- Informations contextuelles
    r.numero AS room_number,
    b.invoice_number AS booking_reference,
    -- Statistiques
    COUNT(*) OVER (PARTITION BY e.error_type) AS similar_errors_count,
    COUNT(*) OVER (PARTITION BY e.room_id) AS room_errors_count
FROM public.sync_error_log e
LEFT JOIN public.rooms r ON e.room_id = r.id
LEFT JOIN public.bookings b ON e.booking_id = b.id
ORDER BY e.created_at DESC;

COMMENT ON VIEW public.sync_errors_dashboard IS 'Vue de supervision des erreurs de synchronisation';

-- ============================================================================
-- 7. VUE DES CONFLITS ACTIFS
-- ============================================================================

CREATE OR REPLACE VIEW public.active_booking_conflicts AS
SELECT
    bc.id,
    bc.booking_id_1,
    bc.booking_id_2,
    bc.room_id,
    r.numero AS room_number,
    bc.conflict_type,
    bc.overlap_start,
    bc.overlap_end,
    bc.is_resolved,
    bc.created_at,
    -- Détails des réservations
    b1.status AS booking_1_status,
    b2.status AS booking_2_status,
    b1.created_at AS booking_1_created,
    b2.created_at AS booking_2_created,
    -- Calcul de la durée du conflit
    EXTRACT(EPOCH FROM (LEAST(b1.date_fin_prevue, b2.date_fin_prevue) - GREATEST(b1.date_debut_prevue, b2.date_debut_prevue))) / 3600 AS overlap_hours
FROM public.booking_conflicts bc
JOIN public.rooms r ON bc.room_id = r.id
JOIN public.bookings b1 ON bc.booking_id_1 = b1.id
JOIN public.bookings b2 ON bc.booking_id_2 = b2.id
WHERE bc.is_resolved = false
ORDER BY bc.created_at DESC;

COMMENT ON VIEW public.active_booking_conflicts IS 'Liste des conflits de réservations non résolus';

-- ============================================================================
-- 8. FONCTION DE NETTOYAGE DES ANCIENNES ERREURS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_sync_errors(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Supprimer les erreurs résolues anciennes
    DELETE FROM public.sync_error_log
    WHERE is_resolved = true
      AND resolved_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Supprimer les conflits résolus anciens
    DELETE FROM public.booking_conflicts
    WHERE is_resolved = true
      AND resolved_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_sync_errors IS 'Nettoie les anciennes erreurs et conflits résolus';

-- ============================================================================
-- 9. TRIGGER POUR DÉTECTION AUTOMATIQUE DES CONFLITS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_booking_conflicts_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conflict_count INTEGER;
BEGIN
    -- Vérifier les conflits avec les réservations existantes
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.bookings b
    WHERE b.room_id = NEW.room_id
      AND b.id != NEW.id
      AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
      AND NEW.date_debut_prevue < b.date_fin_prevue
      AND NEW.date_fin_prevue > b.date_debut_prevue;
    
    IF v_conflict_count > 0 THEN
        -- Enregistrer le conflit
        INSERT INTO public.booking_conflicts (
            booking_id_1,
            booking_id_2,
            room_id,
            conflict_type,
            overlap_start,
            overlap_end
        )
        SELECT
            CASE WHEN b.id < NEW.id THEN b.id ELSE NEW.id END,
            CASE WHEN b.id < NEW.id THEN NEW.id ELSE b.id END,
            NEW.room_id,
            'OVERLAP',
            GREATEST(NEW.date_debut_prevue, b.date_debut_prevue),
            LEAST(NEW.date_fin_prevue, b.date_fin_prevue)
        FROM public.bookings b
        WHERE b.room_id = NEW.room_id
          AND b.id != NEW.id
          AND b.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
          AND NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
          AND NEW.date_debut_prevue < b.date_fin_prevue
          AND NEW.date_fin_prevue > b.date_debut_prevue;
        
        -- Logger l'avertissement
        PERFORM public.log_sync_error(
            'CONFLICT',
            'Conflit de réservation détecté lors de la création',
            'check_booking_conflicts_on_insert',
            NEW.room_id,
            NEW.id,
            jsonb_build_object(
                'conflict_count', v_conflict_count,
                'booking_status', NEW.status
            ),
            'WARNING'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_booking_conflicts_on_insert IS 'Détecte automatiquement les conflits lors de la création de réservations';

-- Suppression du trigger s'il existe
DROP TRIGGER IF EXISTS trg_check_booking_conflicts ON public.bookings;

-- Création du trigger
CREATE TRIGGER trg_check_booking_conflicts
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.check_booking_conflicts_on_insert();

-- ============================================================================
-- 10. PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.sync_error_log TO authenticated;
GRANT INSERT ON public.sync_error_log TO authenticated;
GRANT UPDATE ON public.sync_error_log TO authenticated;
GRANT SELECT ON public.booking_conflicts TO authenticated;
GRANT INSERT ON public.booking_conflicts TO authenticated;
GRANT UPDATE ON public.booking_conflicts TO authenticated;
GRANT SELECT ON public.sync_errors_dashboard TO authenticated;
GRANT SELECT ON public.active_booking_conflicts TO authenticated;

GRANT EXECUTE ON FUNCTION public.log_sync_error TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_booking_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_booking_conflict TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_sync_errors TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_booking_conflicts_on_insert TO authenticated;

-- ============================================================================
-- 11. PLANIFICATION DU NETTOYAGE
-- ============================================================================

-- Nettoyer les anciennes erreurs une fois par semaine
SELECT cron.schedule(
    'cleanup-sync-errors-weekly',
    '0 4 * * 0',
    'SELECT public.cleanup_old_sync_errors(30)'
);

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Système de gestion des erreurs et conflits installé avec succès!';
    RAISE NOTICE '- Table sync_error_log créée';
    RAISE NOTICE '- Table booking_conflicts créée';
    RAISE NOTICE '- Fonctions de gestion des erreurs créées';
    RAISE NOTICE '- Trigger de détection automatique des conflits activé';
    RAISE NOTICE '- Nettoyage automatique planifié (hebdomadaire)';
END $$;
