-- Migration: Données initiales Comptabilité (Plan Comptable)
-- Date: 3 janvier 2026

INSERT INTO public.accounts (code, name, type, category, description) VALUES
('1000', 'Trésorerie', 'ASSET', 'Courant', 'Compte de trésorerie principale'),
('1100', 'Banque', 'ASSET', 'Courant', 'Compte bancaire principal'),
('1200', 'Créances Clients', 'ASSET', 'Courant', 'Créances sur les clients'),
('2000', 'Fournisseurs', 'LIABILITY', 'Courant', 'Dettes envers les fournisseurs'),
('2100', 'Emprunts à Court Terme', 'LIABILITY', 'Courant', 'Emprunts à rembourser dans l''année'),
('3000', 'Capital Social', 'EQUITY', 'Permanent', 'Capital apporté par les actionnaires'),
('3100', 'Résultat de l''Exercice', 'EQUITY', 'Permanent', 'Résultat net de l''exercice en cours'),
('4000', 'Revenus de Location', 'REVENUE', 'Opérationnel', 'Revenus provenant des locations'),
('4100', 'Revenus Accessoires', 'REVENUE', 'Opérationnel', 'Revenus provenant de services accessoires'),
('5000', 'Loyers', 'EXPENSE', 'Opérationnel', 'Frais de location des locaux'),
('5100', 'Salaires', 'EXPENSE', 'Opérationnel', 'Frais de personnel'),
('5200', 'Fournitures', 'EXPENSE', 'Opérationnel', 'Frais de fournitures de bureau')
ON CONFLICT (code) DO NOTHING;
