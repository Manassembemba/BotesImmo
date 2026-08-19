-- Migration manuelle pour ajouter les champs de réduction à la table existante

-- Ajouter les colonnes de réduction à la table existante
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_total DECIMAL(10,2);

-- Mettre à jour net_total pour les enregistrements existants
UPDATE invoices SET net_total = total WHERE net_total IS NULL;

-- Vérifier que les colonnes ont été ajoutées
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name IN ('discount_amount', 'discount_percentage', 'net_total');