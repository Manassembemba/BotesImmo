-- Migration: Grant execute permissions for check_booking_conflict
-- Date: 19 janvier 2026
-- Objectif: Accorder la permission d'exécution sur la fonction check_booking_conflict au rôle authenticated,
--          pour permettre aux utilisateurs connectés d'utiliser la vérification de conflit en temps réel.

GRANT EXECUTE ON FUNCTION public.check_booking_conflict(uuid, timestamptz, timestamptz, uuid) TO authenticated;
