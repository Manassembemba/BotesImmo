-- Migration: Ajout colonnes montant_usd et montant_cdf pour comptabilité de caisse
-- Date: 29 décembre 2025
-- Objectif: Tracer séparément les montants USD et CDF reçus physiquement

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS montant_usd DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS montant_cdf DECIMAL(12, 2);

-- 2. Migrer/Corriger les données existantes (Nettoyage)
-- Pour toutes les lignes où la somme (USD + CDF/2800) ne correspond pas au montant total,
-- on réinitialise en considérant que tout était en USD.
UPDATE public.payments
SET 
  montant_usd = montant,
  montant_cdf = 0
WHERE ABS(montant - (montant_usd + montant_cdf / 2800.0)) >= 1.00;

-- 3. Rendre les colonnes NOT NULL maintenant qu'elles sont remplies
ALTER TABLE public.payments
  ALTER COLUMN montant_usd SET DEFAULT 0,
  ALTER COLUMN montant_cdf SET DEFAULT 0,
  ALTER COLUMN montant_usd SET NOT NULL,
  ALTER COLUMN montant_cdf SET NOT NULL;

-- 4. Ajouter contrainte de cohérence (Idempotent)
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS check_montant_coherence;
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

-- 7. Créer vue pour rapport de caisse améliorée avec types (V2)
CREATE OR REPLACE VIEW public.caisse_daily_summary AS
SELECT
  DATE(p.date_paiement) as date,
  CASE 
    WHEN i.invoice_number ILIKE 'INV-EXT-%' THEN 'PROLONGATION'
    WHEN i.invoice_number ILIKE 'FACT-%' THEN 'RESERVATION'
    -- Si pas de facture direct, on vérifie si la réservation a été prolongée
    WHEN EXISTS (SELECT 1 FROM public.invoices inv2 WHERE inv2.booking_id = p.booking_id AND inv2.invoice_number ILIKE 'INV-EXT-%') 
         AND p.created_at > (SELECT MIN(created_at) FROM public.payments p2 WHERE p2.booking_id = p.booking_id)
         THEN 'PROLONGATION'
    ELSE 'RESERVATION'
  END as type,
  SUM(p.montant_usd) as total_usd,
  SUM(p.montant_cdf) as total_cdf,
  SUM(p.montant) as total_equivalent_usd,
  COUNT(*) as nombre_paiements,
  ARRAY_AGG(DISTINCT p.methode) as methodes_utilisees
FROM public.payments p
LEFT JOIN public.invoices i ON p.invoice_id = i.id
WHERE p.date_paiement >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(p.date_paiement), type
ORDER BY date DESC, type ASC;

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
