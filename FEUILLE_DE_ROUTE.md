# Feuille de Route - Botes Immo

Ce document sert de guide pour les développements futurs de l'application Botes Immo. Il a pour but de structurer les tâches, de définir les priorités et de garantir la cohérence des nouvelles fonctionnalités avec l'architecture existante.

> **Dernière mise à jour :** 27 décembre 2025  
> **Analyses de référence :** Voir `/C:/Users/MANASSE MBEMBA/.gemini/antigravity/brain/33b4b130-6a9d-49b8-adcf-eba2b17c9a91/`

---

## Module 1 : Gestion de Caisse et Paiements Avancés ✅ **TERMINÉ**

**Objectif :** Améliorer la flexibilité et l'ergonomie de la saisie des paiements pour les utilisateurs.

**Statut :** ✅ **Implémenté et fonctionnel**

**Fonctionnalités implémentées :**

1.  **Saisie de Paiement Multi-devises (USD/CDF)** ✅
    *   ✅ **Tâche 1.1 :** Formulaire de paiement (`ManagePaymentDialog.tsx`) avec deux champs distincts USD et CDF (lignes 170-183)
    *   ✅ **Tâche 1.2 :** Synchronisation en temps réel via `handleUsdChange` et `handleCdfChange` (lignes 95-110)
    *   ✅ **Tâche 1.3 :** Montant toujours enregistré en USD dans la base de données via `form.setValue('montant', usdNumber)`

2.  **Indicateur de Paiement en Temps Réel** ✅
    *   ✅ **Tâche 2.1 :** Badge dynamique affichant "Paiement partiel", "Paiement complet" ou "Paiement avec surplus" (lignes 112-124)

3.  **Extension aux Autres Formulaires** ✅
    *   ✅ **Tâche 3.1 :** Appliqué au champ "Acompte" dans `CreateBookingDialog.tsx`
    *   ✅ **Tâche 3.2 :** Appliqué aux champs dans `EditBookingDialog.tsx` et `CheckoutDecisionDialog.tsx`

4.  **Comptabilité de Caisse Physique (Nouveau)** ✅
    *   ✅ **Tâche 4.1 :** Mode "Paiement Mixte" dans `ManagePaymentDialog` pour saisie séparée USD/CDF
    *   ✅ **Tâche 4.2 :** Stockage des montants physiques `montant_usd` et `montant_cdf` en base

**Recommandations d'amélioration :**
- Extraire la logique de conversion USD/CDF dans un hook réutilisable `useCurrencyConverter`
- Ajouter un composant `CurrencyInput` réutilisable pour standardiser l'UI
- Appliquer la même logique au formulaire de création de réservation

---

## Module 2 : Rapports Financiers Améliorés (Partiellement implémenté)

**Objectif :** Fournir aux administrateurs des outils puissants pour l'analyse des revenus et des performances.

**Fonctionnalités :**

1.  **Rapport Financier Complet (Terminé)**
    *   **Statut :** Implémenté.
    *   **Description :** Une page dédiée (`/reports/financial-report`) est disponible, avec des filtres, des statistiques agrégées (total facturé, payé, dû) et un tableau détaillé de toutes les factures. Les exports CSV et PDF sont fonctionnels.

2.  **Rapport de Revenus Détaillé (À développer)**
    *   **Tâche 2.1 :** Développer la page existante `/reports/revenue`.
    *   **Tâche 2.2 :** Afficher des ventilations des revenus par type de chambre, par période, etc.
    *   **Tâche 2.3 :** Ajouter des graphiques pour visualiser les tendances de revenus.

3.  **Rapport sur le Taux d'Occupation (À développer)**
    *   **Tâche 3.1 :** Développer la page associée.
    *   **Tâche 3.2 :** Afficher des statistiques détaillées et des graphiques sur l'occupation des chambres.

---

## Module 3 : Gestion des Dépenses (Suggestion pour le futur)

**Objectif :** Intégrer un suivi des dépenses de l'entreprise pour obtenir une vue financière complète (Revenus - Dépenses = Profit).

**Fonctionnalités potentielles :**
-   Création d'une table `expenses` dans la base de données.
-   Interface pour ajouter, modifier et catégoriser les dépenses (ex: loyer, salaires, maintenance, achats).
-   Intégration des dépenses dans les rapports financiers pour calculer la rentabilité.

---

## Module 4 : Nettoyage et Maintenance Technique 🔧 **PRIORITÉ HAUTE**

**Objectif :** Nettoyer le projet des fichiers et configurations obsolètes créés pendant les phases de débogage.

**Tâches :**

1.  **Nettoyage des migrations** 🔴 **URGENT**
    *   **Tâche 1.1 :** Supprimer les 10 migrations redondantes de `extend_stay` (20251220 à 20251226)
    *   **Tâche 1.2 :** Consolider en une seule migration finale
    *   **Fichiers concernés :**
        - `20251220150000_create_extend_stay_function.sql`
        - `20251220200000_update_extend_stay_function.sql`
        - `20251223000004_update_extend_stay_rpc.sql`
        - `20251223000006_update_extend_stay_with_invoice.sql`
        - `20251225120000_fix_extend_stay_invoice_status.sql`
        - `20251225140000_add_logging_to_extend_stay_v2.sql`
        - `20251225150000_revert_extend_stay_function.sql`
        - `20251225190000_install_final_extend_stay_function.sql`
        - `20251226200000_fix_extend_stay_insert.sql`
        - `20251226210000_fix_extend_stay_item_id.sql`
    *   **Garder uniquement :** `20251226220000_add_full_logging_to_extend_stay_final.sql`

2.  **Nettoyage des fonctions de la base de données**
    *   **Tâche 2.1 :** Supprimer les anciennes versions de la fonction `extend_stay` (en plpgsql)
    *   **Tâche 2.2 :** Vérifier que seule l'Edge Function `extend-stay` est utilisée
    *   **Tâche 2.3 :** Supprimer les fonctions RPC obsolètes non utilisées

3.  **Correction du code dupliqué**
    *   **Tâche 3.1 :** Supprimer la duplication dans `ManagePaymentDialog.tsx` (lignes 248-536 sont identiques à 1-247)
    *   **Impact :** Réduction de ~50% de la taille du fichier

---

## Module 5 : Optimisation Architecture Réservation/Facturation 🚀 **PRIORITÉ HAUTE**

**Objectif :** Améliorer la cohérence, la performance et la fiabilité du système de réservation et facturation.

**Référence :** Voir `analyse_reservation_facturation.md`

**Fonctionnalités prioritaires :**

1.  **Transaction Atomique Réservation + Facture** 🔴 **CRITIQUE**
    *   **Problème actuel :** Si la génération de facture échoue, la réservation est déjà créée (incohérence)
    *   **Solution :** Créer une RPC SQL unique `create_booking_with_invoice_atomic`
    *   **Avantages :**
        - ✅ Atomicité garantie (rollback automatique si erreur)
        - ✅ Performance améliorée (-30% temps de réponse)
        - ✅ Cohérence des données assurée
    *   **Fichiers à créer :**
        - `supabase/migrations/YYYYMMDD_create_booking_with_invoice_atomic.sql`
    *   **Fichiers à modifier :**
        - `src/hooks/useBookings.ts` (ligne 103-174)

2.  **Vue Agrégée des Factures par Réservation** 🟡 **IMPORTANTE**
    *   **Problème actuel :** Calcul manuel des totaux pour factures multiples (extensions)
    *   **Solution :** Créer une vue SQL `booking_invoices_summary`
    *   **Données fournies :**
        - Total facturé
        - Total payé
        - Solde dû
        - Statut de paiement global
        - Liste des factures
    *   **Fichiers à créer :**
        - `supabase/migrations/YYYYMMDD_create_booking_invoices_summary_view.sql`
        - `src/hooks/useBookingInvoicesSummary.ts`

3.  **Composant Résumé Financier Unifié** 🟡 **IMPORTANTE**
    *   **Objectif :** Affichage centralisé de toutes les factures et paiements d'une réservation
    *   **Fichiers à créer :**
        - `src/components/bookings/BookingFinancialPanel.tsx`
    *   **Fonctionnalités :**
        - Affichage des totaux agrégés
        - Liste de toutes les factures avec statuts
        - Historique des paiements
        - Actions rapides (voir facture, enregistrer paiement)

4.  **Tests Automatisés** 🟢 **RECOMMANDÉE**
    *   **Tâche 4.1 :** Tests unitaires pour `invoiceService.ts` (calculs)
    *   **Tâche 4.2 :** Tests d'intégration pour flux complet réservation → facture → paiement
    *   **Fichiers à créer :**
        - `src/services/__tests__/invoiceService.test.ts`
        - `src/hooks/__tests__/useBookings.integration.test.ts`

---

## Module 6 : Optimisation Système de Prolongation 🔄 **PRIORITÉ MOYENNE**

**Objectif :** Améliorer la fiabilité et la performance du système de prolongation de séjour.

**Référence :** Voir `analyse_prolongation_factures.md`

**Fonctionnalités prioritaires :**

1.  **Transaction Atomique pour Prolongation** 🔴 **CRITIQUE**
    *   **Problème actuel :** Si création facture échoue, réservation déjà prolongée
    *   **Solution :** Créer RPC SQL `extend_stay_atomic`
    *   **Avantages :**
        - ✅ Rollback automatique si erreur
        - ✅ Performance améliorée (1 appel au lieu de 3-4)
        - ✅ Pas besoin d'Edge Function
    *   **Fichiers à créer :**
        - `supabase/migrations/YYYYMMDD_create_extend_stay_atomic.sql`
    *   **Fichiers à modifier :**
        - `src/hooks/useBookings.ts` (useExtendStay)

2.  **Vérification de Conflits avant Prolongation** 🟡 **IMPORTANTE**
    *   **Problème actuel :** Pas de vérification si chambre disponible pour période prolongée
    *   **Solution :** Appeler `check_booking_conflict` avant prolongation
    *   **Fichiers à modifier :**
        - `supabase/functions/extend-stay/index.ts` (ligne 30-40)
        - Ou dans la nouvelle RPC `extend_stay_atomic`

3.  **Application Multi-devises au Formulaire de Prolongation** 🟢 **RECOMMANDÉE**
    *   **Objectif :** Même UX que le formulaire de paiement
    *   **Fichiers à modifier :**
        - `src/components/checkout/CheckoutDecisionDialog.tsx` (ligne 264-321)

---

## Module 7 : Amélioration Rapports et Analytics 📊 **PRIORITÉ MOYENNE**

**Objectif :** Fournir aux administrateurs des outils puissants pour l'analyse des revenus et des performances.

**Fonctionnalités :**

1.  **Rapport Financier Complet** ✅ **TERMINÉ**
    *   **Statut :** Implémenté
    *   **Page :** `/reports/financial-report`
    *   **Fonctionnalités :** Filtres, statistiques agrégées, exports CSV/PDF
    *   **Ajout :** Onglet "Caisse Physique" pour suivi trésorerie USD/CDF ✅

2.  **Rapport de Revenus Détaillé** 🟡 **À DÉVELOPPER**
    *   **Tâche 2.1 :** Développer la page `/reports/revenue`
    *   **Tâche 2.2 :** Ventilations par type de chambre, période, agent
    *   **Tâche 2.3 :** Graphiques de tendances (Chart.js ou Recharts)
    *   **Fichiers à créer :**
        - `src/pages/reports/RevenueReport.tsx`
        - `src/components/reports/RevenueChart.tsx`

3.  **Rapport sur le Taux d'Occupation** 🟡 **À DÉVELOPPER**
    *   **Tâche 3.1 :** Développer la page `/reports/occupancy`
    *   **Tâche 3.2 :** Statistiques par chambre, par période
    *   **Tâche 3.3 :** Graphiques d'occupation (heatmap, timeline)
    *   **Fichiers à créer :**
        - `src/pages/reports/OccupancyReport.tsx`
        - `src/hooks/useOccupancyStats.ts`

4.  **Dashboard Administrateur Amélioré** 🟢 **RECOMMANDÉE**
    *   **Tâche 4.1 :** Ajouter graphiques de tendances sur la page d'accueil
    *   **Tâche 4.2 :** KPIs en temps réel (revenus du mois, taux d'occupation)
    *   **Fichiers à modifier :**
        - `src/pages/Index.tsx`

---

## Module 8 : Gestion des Dépenses 💰 **PRIORITÉ BASSE**

**Objectif :** Intégrer un suivi des dépenses de l'entreprise pour obtenir une vue financière complète (Revenus - Dépenses = Profit).

**Fonctionnalités potentielles :**

1.  **Structure de Base de Données**
    *   **Tâche 1.1 :** Créer table `expenses`
    *   **Champs :**
        - `id` (UUID)
        - `date` (DATE)
        - `amount` (NUMERIC)
        - `category` (TEXT) - ex: loyer, salaires, maintenance, achats
        - `description` (TEXT)
        - `payment_method` (TEXT)
        - `receipt_url` (TEXT) - lien vers justificatif
        - `created_by` (UUID) - référence à users
        - `created_at`, `updated_at`
    *   **Fichiers à créer :**
        - `supabase/migrations/YYYYMMDD_create_expenses_table.sql`

2.  **Interface de Gestion**
    *   **Tâche 2.1 :** Page de liste des dépenses
    *   **Tâche 2.2 :** Formulaire d'ajout/modification
    *   **Tâche 2.3 :** Catégorisation et filtres
    *   **Fichiers à créer :**
        - `src/pages/Expenses.tsx`
        - `src/hooks/useExpenses.ts`
        - `src/components/expenses/ManageExpenseDialog.tsx`

3.  **Intégration dans Rapports Financiers**
    *   **Tâche 3.1 :** Ajouter section "Dépenses" dans le rapport financier
    *   **Tâche 3.2 :** Calculer et afficher le profit (Revenus - Dépenses)
    *   **Tâche 3.3 :** Graphiques comparatifs revenus vs dépenses
    *   **Fichiers à modifier :**
        - `src/pages/reports/FinancialReport.tsx`

---

## Priorités Recommandées

### 🔴 URGENT (À faire immédiatement)
1. **Module 4.1** - Nettoyage des migrations redondantes
2. **Module 4.3** - Correction du code dupliqué dans ManagePaymentDialog
3. **Module 5.1** - Transaction atomique réservation + facture
4. **Module 6.1** - Transaction atomique pour prolongation

### 🟡 IMPORTANT (À planifier prochainement)
1. **Module 1.3** - Extension multi-devises au CreateBookingDialog
2. **Module 5.2** - Vue agrégée des factures
3. **Module 5.3** - Composant résumé financier unifié
4. **Module 6.2** - Vérification de conflits avant prolongation
5. **Module 7.2** - Rapport de revenus détaillé
6. **Module 7.3** - Rapport sur le taux d'occupation

### 🟢 RECOMMANDÉ (Amélioration continue)
1. **Module 5.4** - Tests automatisés
2. **Module 6.3** - Multi-devises dans prolongation
3. **Module 7.4** - Dashboard administrateur amélioré

### ⚪ FUTUR (Long terme)
1. **Module 8** - Gestion des dépenses (complet)

---

## Notes Techniques

### Analyses de Référence
Les analyses détaillées suivantes sont disponibles dans le dossier `.gemini/antigravity/brain/` :
- `analyse_projet_botes_immo.md` - Vue d'ensemble complète du projet
- `analyse_reservation_facturation.md` - Communication modules réservation/facturation
- `analyse_prolongation_factures.md` - Système de prolongation de séjour (11 itérations)

### Conventions de Code
- **Hooks personnalisés :** Préfixe `use`, ex: `useBookings`, `useCurrencyConverter`
- **Composants :** PascalCase, ex: `BookingFinancialPanel`
- **Services :** Suffixe `Service`, ex: `invoiceService`, `invoiceDbService`
- **Migrations :** Format `YYYYMMDDHHMMSS_description.sql`

### Architecture Recommandée
```
src/
├── components/
│   ├── bookings/          # Composants liés aux réservations
│   ├── invoices/          # Composants liés aux factures
│   ├── payments/          # Composants liés aux paiements
│   └── reports/           # Composants de rapports
├── hooks/                 # Hooks personnalisés
├── services/              # Logique métier
├── interfaces/            # Types TypeScript
└── pages/                 # Pages principales

supabase/
├── migrations/            # Migrations SQL
└── functions/             # Edge Functions
```

---

**Dernière révision :** 27 décembre 2025  
**Prochaine révision recommandée :** Après implémentation des tâches URGENTES
