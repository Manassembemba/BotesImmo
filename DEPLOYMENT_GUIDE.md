# 🚀 Déploiement du Système de Synchronisation Amélioré

## ✅ Checklist de Déploiement

### 1. Pré-requis

- [ ] Accès admin à la base de données Supabase
- [ ] Extension `pg_cron` activée
- [ ] Backup de la base de données effectué

### 2. Migrations SQL

Exécuter dans l'ordre:

```bash
# 1. Système principal
supabase/migrations/20260324000000_enhanced_room_sync_system.sql

# 2. Gestion des erreurs
supabase/migrations/20260324010000_sync_error_handling.sql
```

**Via Supabase Dashboard:**
1. Aller dans **SQL Editor**
2. Copier-coller chaque fichier de migration
3. Exécuter et vérifier l'absence d'erreurs

**Via Supabase CLI:**
```bash
supabase db push
```

### 3. Edge Function

Déployer la fonction Edge:

```bash
# Déployer la fonction
supabase functions deploy auto-checkout-processor

# Vérifier le déploiement
supabase functions list
```

### 4. Vérifications

Après déploiement, exécuter:

```sql
-- 1. Vérifier les tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'room_%' OR table_name LIKE 'sync_%' OR table_name LIKE 'booking_%';

-- 2. Vérifier les fonctions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%sync%' OR routine_name LIKE '%room%';

-- 3. Tester la synchronisation
SELECT sync_room_statuses();

-- 4. Vérifier les statistiques
SELECT * FROM get_sync_statistics();

-- 5. Vérifier les planifications
SELECT * FROM cron.job;
```

### 5. Configuration pg_cron

Si pg_cron n'est pas activé:

1. Aller dans **Supabase Dashboard** → **Database** → **Extensions**
2. Activer `pg_cron`
3. Vérifier les planifications:

```sql
SELECT * FROM cron.job;
-- Doit afficher:
-- - sync-room-statuses-quarter-hour
-- - auto-checkout-processor
-- - cleanup-sync-errors-weekly
-- - cleanup-audit-logs-weekly
```

### 6. Tests

#### Test 1: Synchronisation manuelle
```sql
SELECT sync_room_statuses();
-- Doit retourner un nombre (même 0)
```

#### Test 2: Dashboard
1. Naviguer vers `/sync-dashboard`
2. Vérifier l'affichage des statistiques
3. Tester le bouton "Synchroniser"

#### Test 3: Edge Function
```bash
# Tester localement (optionnel)
supabase functions serve auto-checkout-processor

# Ou tester en production
curl -X POST 'https://your-project.supabase.co/functions/v1/auto-checkout-processor' \
  -H 'Authorization: Bearer YOUR_SERVICE_KEY'
```

### 7. Monitoring

Après déploiement:

```sql
-- Vérifier les erreurs
SELECT * FROM sync_errors_dashboard 
WHERE is_resolved = false 
ORDER BY created_at DESC 
LIMIT 10;

-- Vérifier les conflits
SELECT * FROM active_booking_conflicts;

-- Vérifier l'audit
SELECT * FROM room_transitions_recent 
LIMIT 20;
```

---

## 📊 URLs Importantes

- **Dashboard Sync:** `https://your-app.com/sync-dashboard`
- **Edge Function:** `https://your-project.supabase.co/functions/v1/auto-checkout-processor`
- **Supabase Dashboard:** `https://app.supabase.com/project/your-project`

---

## 🔧 Paramètres par Défaut

| Paramètre | Valeur | Modification |
|-----------|--------|--------------|
| Heure check-out | 11:00 | `room_sync_settings` |
| Durée nettoyage | 1 heure | `room_sync_settings` |
| Fréquence sync | 15 min | pg_cron job |
| Timezone | Africa/Lubumbashi | Hardcodé |
| Rétention logs | 90 jours | `cleanup_old_audit_logs()` |
| Rétention erreurs | 30 jours | `cleanup_old_sync_errors()` |

---

## ⚠️ Points d'Attention

1. **Timezone:** Toutes les fonctions utilisent `Africa/Lubumbashi` (UTC+2)
2. **Permissions:** Les fonctions sont en `SECURITY DEFINER`
3. **Performance:** Les index sont créés automatiquement
4. **Notifications:** Utilise `pg_notify` (WebSocket)
5. **Conflits:** Détection automatique à la création de réservation

---

## 🆘 Dépannage

### Problème: pg_cron non activé
**Solution:** 
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```
Si erreur, contacter le support Supabase.

### Problème: Edge Function échoue
**Solution:**
1. Vérifier les logs: `supabase functions logs auto-checkout-processor`
2. Vérifier les variables d'environnement
3. Tester manuellement la RPC `process_daily_room_transitions()`

### Problème: Dashboard ne charge pas
**Solution:**
1. Vérifier la console navigateur (erreurs JS)
2. Vérifier les permissions RLS
3. Tester les vues manuellement dans SQL Editor

### Problème: Synchronisation ne fonctionne pas
**Solution:**
```sql
-- Vérifier les données
SELECT * FROM room_sync_dashboard LIMIT 10;

-- Tester manuellement
SELECT sync_room_statuses();

-- Vérifier les erreurs
SELECT * FROM sync_errors_dashboard 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## 📞 Support

En cas de problème:
1. Consulter la documentation: `SYNC_SYSTEM_DOCUMENTATION.md`
2. Vérifier les logs d'erreurs
3. Contacter l'équipe de développement

---

**Date:** 24 Mars 2026  
**Version:** 1.0.0  
**Statut:** ✅ Prêt pour production
