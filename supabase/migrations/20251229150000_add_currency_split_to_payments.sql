-- Migration: Ajout colonnes montant_usd et montant_cdf pour comptabilité de caisse
-- Date: 29 décembre 2025
-- Objectif: Tracer séparément les montants USD et CDF reçus physiquement

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS montant_usd DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS montant_cdf DECIMAL(12, 2);

-- 2. Migrer les données existantes
-- Assumer que tous les paiements actuels sont en USD pur
UPDATE public.payments
SET 
  montant_usd = montant,
  montant_cdf = 0
WHERE montant_usd IS NULL;

-- 3. Rendre les colonnes NOT NULL maintenant qu'elles sont remplies
ALTER TABLE public.payments
  ALTER COLUMN montant_usd SET DEFAULT 0,
  ALTER COLUMN montant_cdf SET DEFAULT 0,
  ALTER COLUMN montant_usd SET NOT NULL,
  ALTER COLUMN montant_cdf SET NOT NULL;

-- 4. Ajouter contrainte de cohérence
-- Le montant total doit être égal à montant_usd + (montant_cdf / taux)
-- Tolérance de 1 USD pour les arrondis
ALTER TABLE public.payments
  ADD CONSTRAINT check_montant_coherence
  CHECK (
    ABS(montant - (montant_usd + montant_cdf / 2800.0)) < 1.00
  );

-- 5. Ajouter index pour recherches par devise
CREATE INDEX IF NOT EXISTS idx_payments_montant_usd 
  ON public.payments(montant_usd) 
  WHERE montant_usd > 0;

CREATE INDEX IF NOT EXISTS idx_payments_montant_cdf 
  ON public.payments(montant_cdf) 
  WHERE montant_cdf > 0;

-- 6. Commentaires pour documentation
COMMENT ON COLUMN public.payments.montant_usd IS 'Montant réellement payé en USD (caisse physique)';
COMMENT ON COLUMN public.payments.montant_cdf IS 'Montant réellement payé en CDF (caisse physique)';
COMMENT ON COLUMN public.payments.montant IS 'Total équivalent en USD pour calculs et factures';

-- 7. Créer vue pour rapport de caisse
CREATE OR REPLACE VIEW public.caisse_daily_summary AS
SELECT
  DATE(date_paiement) as date,
  SUM(montant_usd) as total_usd,
  SUM(montant_cdf) as total_cdf,
  SUM(montant) as total_equivalent_usd,
  COUNT(*) as nombre_paiements,
  ARRAY_AGG(DISTINCT methode) as methodes_utilisees
FROM public.payments
WHERE date_paiement >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(date_paiement)
ORDER BY date DESC;

COMMENT ON VIEW public.caisse_daily_summary IS 'Résumé quotidien de la caisse avec montants séparés USD/CDF';

-- 8. Permissions sur la vue
GRANT SELECT ON public.caisse_daily_summary TO authenticated;

-- 9. Fonction helper pour obtenir le total actuel en caisse
CREATE OR REPLACE FUNCTION public.get_caisse_totals()
RETURNS TABLE (
  total_usd DECIMAL,
  total_cdf DECIMAL,
  total_equivalent_usd DECIMAL,
  derniere_mise_a_jour TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(montant_usd), 0) as total_usd,
    COALESCE(SUM(montant_cdf), 0) as total_cdf,
    COALESCE(SUM(montant), 0) as total_equivalent_usd,
    MAX(created_at) as derniere_mise_a_jour
  FROM public.payments;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_totals() TO authenticated;

COMMENT ON FUNCTION public.get_caisse_totals() IS 'Retourne les totaux actuels en caisse (USD, CDF et équivalent USD total)';
