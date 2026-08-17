# 🔄 Système de Synchronisation Automatisé et Amélioré

## 📋 Vue d'ensemble

Ce document présente les améliorations apportées au système de synchronisation des statuts de chambres et des réservations.

---

## 🎯 Objectifs Atteints

1. ✅ **Audit complet** - Toutes les transitions sont journalisées
2. ✅ **Automatisation accrue** - Synchronisation toutes les 15 minutes
3. ✅ **Timezone support** - Africa/Lubumbashi (UTC+2) natif
4. ✅ **Dashboard de supervision** - Vue en temps réel des synchronisations
5. ✅ **Gestion des erreurs** - Système de logging et résolution de conflits
6. ✅ **Check-out automatique** - Traitement programmé des départs
7. ✅ **Notifications** - Système de notification en temps réel
8. ✅ **Performance** - Index optimisés pour les requêtes

---

## 📁 Fichiers Créés/Modifiés

### Migrations SQL

| Fichier | Description |
|---------|-------------|
| `20260324000000_enhanced_room_sync_system.sql` | Système de synchronisation amélioré |
| `20260324010000_sync_error_handling.sql` | Gestion des erreurs et conflits |

### Edge Functions

| Fichier | Description |
|---------|-------------|
| `supabase/functions/auto-checkout-processor/index.ts` | Traitement automatique des check-outs |

### Pages React

| Fichier | Description |
|---------|-------------|
| `src/pages/SyncDashboard.tsx` | Dashboard de supervision |
| `src/App.tsx` | Route `/sync-dashboard` ajoutée |
| `src/components/layout/Sidebar.tsx` | Lien "Synchronisation" ajouté |

---

## 🏗️ Architecture du Système

```
┌─────────────────────────────────────────────────────────────────┐
│                  SYSTÈME DE SYNCHRONISATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SYNCHRONISATION DES STATUTS                                 │
│     ├─ sync_room_statuses() - Fonction principale améliorée     │
│     ├─ Timezone: Africa/Lubumbashi                              │
│     ├─ Audit logging automatique                                │
│     └─ Gestion de tous les statuts (BOOKED, PENDING_CHECKOUT)   │
│                                                                 │
│  2. AUTOMATISATIONS (pg_cron)                                   │
│     ├─ sync-room-statuses-quarter-hour (*/15 * * * *)           │
│     ├─ auto-checkout-processor (0 11-23 * * *)                  │
│     └─ cleanup-sync-errors-weekly (0 4 * * 0)                   │
│                                                                 │
│  3. EDGE FUNCTIONS                                              │
│     └─ auto-checkout-processor - Check-outs automatiques        │
│                                                                 │
│  4. SUPERVISION                                                 │
│     ├─ room_sync_dashboard - Vue temps réel                     │
│     ├─ room_transitions_recent - Historique                     │
│     ├─ sync_errors_dashboard - Erreurs                          │
│     └─ active_booking_conflicts - Conflits                      │
│                                                                 │
│  5. GESTION DES ERREURS                                         │
│     ├─ sync_error_log - Journal des erreurs                     │
│     ├─ booking_conflicts - Conflits de réservations             │
│     ├─ log_sync_error() - Fonction de logging                   │
│     └─ resolve_booking_conflict() - Résolution auto             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Nouvelles Tables

### `room_status_audit_log`

Journalise toutes les transitions de statuts de chambres.

```sql
CREATE TABLE room_status_audit_log (
    id UUID,
    room_id UUID,
    previous_status TEXT,
    new_status TEXT,
    transition_type TEXT, -- 'MANUAL', 'AUTOMATIC', 'TRIGGER', 'CRON'
    reason TEXT,
    created_at TIMESTAMPTZ
);
```

### `sync_error_log`

Journalise les erreurs de synchronisation.

```sql
CREATE TABLE sync_error_log (
    id UUID,
    error_type TEXT, -- 'CONFLICT', 'TIMEOUT', 'DATABASE', etc.
    error_message TEXT,
    severity TEXT, -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    is_resolved BOOLEAN,
    created_at TIMESTAMPTZ
);
```

### `booking_conflicts`

Gère les conflits de réservations (chevauchements).

```sql
CREATE TABLE booking_conflicts (
    id UUID,
    booking_id_1 UUID,
    booking_id_2 UUID,
    room_id UUID,
    conflict_type TEXT, -- 'OVERLAP', 'DOUBLE_BOOKING'
    is_resolved BOOLEAN,
    resolution_method TEXT
);
```

### `room_sync_settings`

Paramètres de configuration.

```sql
CREATE TABLE room_sync_settings (
    setting_key TEXT,
    setting_value JSONB,
    is_active BOOLEAN
);
```

**Paramètres par défaut:**
- `checkout_time`: 11:00
- `cleaning_duration_hours`: 1 heure
- `auto_checkout_enabled`: true
- `notification_enabled`: true
- `timezone`: Africa/Lubumbashi

---

## ⚙️ Fonctions Principales

### `sync_room_statuses()`

**Rôle:** Synchronise les statuts des chambres avec les réservations actives.

**Transitions gérées:**
1. `BOOKED` → `Occupé` (début de réservation atteint)
2. `Occupé` → `PENDING_CHECKOUT` (dans les 2h avant la fin)
3. `PENDING_CHECKOUT`/`Occupé` → `A_NETTOYER` (check-out dépassé)
4. `A_NETTOYER` → `Libre` (1h après check-out)
5. `Occupé` → `Libre` (aucune réservation active - sécurité)
6. `Libre`/`Nettoyage` → `Occupé` (réservation active détectée)

**Utilisation:**
```sql
SELECT sync_room_statuses();
-- Retourne: nombre de chambres mises à jour
```

---

### `process_daily_room_transitions()`

**Rôle:** Gère les check-outs automatiques à 11h.

**Actions:**
- Marque les réservations terminées comme `COMPLETED`
- Passe les chambres à `A_NETTOYER`
- Crée les tâches de nettoyage

---

### `log_sync_error()`

**Rôle:** Enregistre une erreur dans le journal d'audit.

**Paramètres:**
```sql
SELECT log_sync_error(
    'CONFLICT',           -- error_type
    'Message d''erreur',  -- error_message
    'nom_fonction',       -- function_name
    room_id,              -- room_id (optionnel)
    booking_id,           -- booking_id (optionnel)
    '{"key": "value"}',   -- context (optionnel)
    'WARNING',            -- severity
    'stack trace'         -- error_stack (optionnel)
);
```

---

### `resolve_booking_conflict()`

**Rôle:** Résout automatiquement un conflit de réservation.

**Paramètres:**
```sql
SELECT resolve_booking_conflict(
    conflict_id,          -- UUID du conflit
    'CANCEL_NEWEST',      -- Méthode: CANCEL_NEWEST ou CANCEL_OLDEST
    user_id               -- Utilisateur qui résout
);
```

---

### `get_sync_statistics()`

**Rôle:** Retourne les statistiques de synchronisation.

**Retourne:**
```sql
SELECT * FROM get_sync_statistics();
-- total_rooms, rooms_synced, pending_checkouts,
-- cleaning_in_progress, transitions_24h, last_sync
```

---

## 🖥️ Dashboard de Supervision

### Page: `/sync-dashboard`

**Fonctionnalités:**
- 📊 Statistiques en temps réel
- 🚨 Chambres requérant attention
- 📜 Historique des transitions
- ⚙️ Paramètres de synchronisation
- 🔄 Synchronisation manuelle
- ⚡ Déclenchement check-out auto

**Composants:**
- `SyncDashboard.tsx` - Page principale
- Auto-rafraîchissement: 30s (stats), 60s (données)

---

## ⏰ Planifications (pg_cron)

| Tâche | Cron | Fréquence | Fonction |
|-------|------|-----------|----------|
| `sync-room-statuses-quarter-hour` | `*/15 * * * *` | Toutes les 15 min | `sync_room_statuses()` |
| `auto-checkout-processor` | `0 11-23 * * *` | Toutes les heures (11h-23h) | Edge Function |
| `cleanup-sync-errors-weekly` | `0 4 * * 0` | Hebdomadaire (dimanche 4h) | `cleanup_old_sync_errors(30)` |

**Activation requise:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 🔔 Notifications en Temps Réel

### Canal: `room_status_changes`

**Payload:**
```json
{
  "room_id": "uuid",
  "room_number": "101",
  "new_status": "A_NETTOYER",
  "previous_status": "Occupé",
  "booking_id": "uuid",
  "timestamp": "2026-03-24T11:00:00+02:00",
  "timezone": "Africa/Lubumbashi"
}
```

### Canal: `sync_errors`

Pour les erreurs critiques uniquement.

---

## 📈 Flux de Synchronisation

```
┌──────────────────────────────────────────────────────────────┐
│                    CYCLE COMPLET                             │
└──────────────────────────────────────────────────────────────┘

1. CRÉATION RÉSERVATION
   ├─ Trigger: trg_check_booking_conflicts
   ├─ Détection conflits → booking_conflicts
   └─ Statut chambre: Libre → BOOKED

2. DÉBUT DE SÉJOUR (date_debut_prevue)
   ├─ Sync auto (toutes les 15 min)
   └─ Statut chambre: BOOKED → Occupé

3. APPROCHE DÉPART (-2 heures)
   ├─ Sync auto
   └─ Statut chambre: Occupé → PENDING_CHECKOUT

4. CHECK-OUT (11:00 ou date_fin_prevue)
   ├─ Edge Function: auto-checkout-processor
   ├─ process_daily_room_transitions()
   ├─ Statut réservation: IN_PROGRESS → COMPLETED
   ├─ Statut chambre: PENDING_CHECKOUT → A_NETTOYER
   └─ Création tâche: NETTOYAGE (TO_DO)

5. NETTOYAGE (1 heure)
   ├─ Tâche: TO_DO → IN_PROGRESS → COMPLETED
   └─ Statut chambre: A_NETTOYER → Libre

6. AUDIT
   ├─ Chaque transition → room_status_audit_log
   └─ Notifications → pg_notify
```

---

## 🛠️ Commandes Utiles

### Supervision

```sql
-- Statistiques en temps réel
SELECT * FROM get_sync_statistics();

-- Voir les chambres nécessitant attention
SELECT * FROM room_sync_dashboard
WHERE status IN ('A_NETTOYER', 'PENDING_CHECKOUT')
   OR hours_until_checkout < 2;

-- Historique des transitions
SELECT * FROM room_transitions_recent;

-- Conflits non résolus
SELECT * FROM active_booking_conflicts;

-- Erreurs non résolues
SELECT * FROM sync_errors_dashboard
WHERE is_resolved = false
ORDER BY created_at DESC;
```

### Maintenance

```sql
-- Nettoyer les anciens logs (30 jours)
SELECT cleanup_old_sync_errors(30);

-- Forcer une synchronisation
SELECT sync_room_statuses();

-- Vérifier les conflits
SELECT * FROM detect_booking_conflicts();

-- Résoudre un conflit
SELECT resolve_booking_conflict(
    'conflict-uuid',
    'CANCEL_NEWEST'
);
```

---

## 🔧 Configuration

### Modifier l'heure de check-out

```sql
UPDATE room_sync_settings
SET setting_value = '{"hour": 12, "minute": 0}'::jsonb
WHERE setting_key = 'checkout_time';
```

### Modifier la durée de nettoyage

```sql
UPDATE room_sync_settings
SET setting_value = '{"hours": 2}'::jsonb
WHERE setting_key = 'cleaning_duration_hours';
```

### Désactiver les check-outs automatiques

```sql
UPDATE room_sync_settings
SET setting_value = '{"enabled": false}'::jsonb
WHERE setting_key = 'auto_checkout_enabled';
```

---

## 🚨 Gestion des Erreurs

### Types d'erreurs

| Type | Description | Sévérité |
|------|-------------|----------|
| `CONFLICT` | Conflit de réservation | WARNING |
| `TIMEOUT` | Timeout de fonction | ERROR |
| `DATABASE` | Erreur base de données | ERROR |
| `VALIDATION` | Erreur de validation | WARNING |
| `UNKNOWN` | Erreur inconnue | ERROR |

### Niveaux de sévérité

- `INFO`: Informationnelle
- `WARNING`: Avertissement (action recommandée)
- `ERROR`: Erreur (action requise)
- `CRITICAL`: Critique (notification immédiate)

---

## 📊 Index de Performance

```sql
-- Pour les requêtes de synchronisation
CREATE INDEX idx_bookings_status_dates 
ON bookings(status, date_debut_prevue, date_fin_prevue);

CREATE INDEX idx_rooms_status_location 
ON rooms(status, location_id);

-- Pour l'audit
CREATE INDEX idx_room_audit_created_at 
ON room_status_audit_log(created_at DESC);

-- Pour les erreurs
CREATE INDEX idx_sync_errors_unresolved 
ON sync_error_log(is_resolved) WHERE is_resolved = false;
```

---

## 🔐 Permissions

Toutes les tables et fonctions sont accessibles aux utilisateurs `authenticated`.

**Tables en lecture/écriture:**
- `room_status_audit_log`
- `sync_error_log`
- `booking_conflicts`

**Vues en lecture seule:**
- `room_sync_dashboard`
- `room_transitions_recent`
- `sync_errors_dashboard`
- `active_booking_conflicts`

---

## 🎯 Prochaines Étapes

1. **Tester en production** - Déployer les migrations
2. **Surveiller les performances** - Vérifier les logs
3. **Ajuster les paramètres** - Selon les besoins réels
4. **Former les utilisateurs** - Utiliser le dashboard
5. **Documenter les incidents** - Via sync_error_log

---

## 📞 Support

Pour toute question ou problème:
1. Consulter `sync_errors_dashboard`
2. Vérifier les logs Edge Function
3. Examiner `room_status_audit_log`
4. Contacter l'administrateur

---

**Date de création:** 24 Mars 2026  
**Version:** 1.0.0  
**Timezone:** Africa/Lubumbashi (UTC+2)
