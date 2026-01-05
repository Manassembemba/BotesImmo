-- Migration: Création de la vue des dettes de dépassement
-- Date: 5 janvier 2026

CREATE OR REPLACE VIEW public.booking_overdue_debts AS
SELECT
    b.id AS booking_id,
    b.tenant_id,
    t.prenom || ' ' || t.nom AS tenant_name,
    b.room_id,
    r.numero AS room_number,
    b.date_debut_prevue,
    b.date_fin_prevue,
    b.prix_total,
    CURRENT_DATE AS report_date,
    
    -- Calcul des jours de retard
    -- Uniquement si la date de fin est passée et pas de check-out réel
    CASE 
        WHEN CURRENT_DATE > b.date_fin_prevue::date AND b.check_out_reel IS NULL THEN 
            (CURRENT_DATE - b.date_fin_prevue::date)
        ELSE 0 
    END AS overdue_days,

    -- Calcul du tarif journalier moyen (basé sur le total / nuits prévues)
    -- Si nuits prévues = 0 (cas rare), on utilise le prix de base de la chambre
    CASE 
        WHEN (b.date_fin_prevue::date - b.date_debut_prevue::date) > 0 THEN
            b.prix_total / (b.date_fin_prevue::date - b.date_debut_prevue::date)
        ELSE
            r.prix_base_nuit
    END AS daily_rate,

    -- Calcul de la dette
    CASE 
        WHEN CURRENT_DATE > b.date_fin_prevue::date AND b.check_out_reel IS NULL THEN 
            (CURRENT_DATE - b.date_fin_prevue::date) * (
                CASE 
                    WHEN (b.date_fin_prevue::date - b.date_debut_prevue::date) > 0 THEN
                        b.prix_total / (b.date_fin_prevue::date - b.date_debut_prevue::date)
                    ELSE
                        r.prix_base_nuit
                END
            )
        ELSE 0
    END AS debt_amount

FROM public.bookings b
JOIN public.tenants t ON b.tenant_id = t.id
JOIN public.rooms r ON b.room_id = r.id
WHERE 
    b.status NOT IN ('CANCELLED', 'COMPLETED', 'REFUSED')
    AND CURRENT_DATE > b.date_fin_prevue::date
    AND b.check_out_reel IS NULL;

-- Commentaire de sécurité
-- Cette vue est accessible via l'API, assurez-vous que RLS est bien configuré sur les tables sous-jacentes
