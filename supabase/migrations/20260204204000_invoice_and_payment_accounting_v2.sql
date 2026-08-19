-- Migration: Automatisation Comptable Avancée (Engagement / Accrual)
-- Date: 4 février 2026
-- Description: Reconnaissance du revenu à la facture et solde de créance au paiement.

-------------------------------------------------------------------------------
-- 1. FONCTION DE COMPTABILISATION DES FACTURES (REVENUS & CRÉANCES)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_invoice_accounting_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id UUID;
  v_entry_number VARCHAR(50);
  v_account_1200_id UUID; -- Créances Clients
  v_account_4000_id UUID; -- Revenus de Location
  v_description TEXT;
  v_amount_to_reverse DECIMAL;
BEGIN
  -- Récupérer les ID des comptes standard
  SELECT id INTO v_account_1200_id FROM public.accounts WHERE code = '1200' LIMIT 1;
  SELECT id INTO v_account_4000_id FROM public.accounts WHERE code = '4000' LIMIT 1;

  -- GESTION DU DELETE OU UPDATE (Contrepassement/Annulation de l'ancienne facture)
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    -- Si c'est un UPDATE, on ne contrepasse que si le montant ou la date a changé
    IF (TG_OP = 'UPDATE' AND OLD.net_total = NEW.net_total AND OLD.date = NEW.date) THEN
       -- Pas de changement financier significatif, on sort
       RETURN NEW;
    END IF;

    v_amount_to_reverse := OLD.net_total;
    -- Ajout d'un suffixe aléatoire pour éviter les collisions (PK violation)
    v_entry_number := 'REV-INV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(OLD.id::text, 1, 8) || '-' || substring(gen_random_uuid()::text, 1, 4);
    v_description := 'Storno Facture ' || OLD.invoice_number || ' - ' || COALESCE(OLD.notes, 'Modif/Suppr');

    -- Insertion de l'écriture de contrepassement (Inverse de la facture)
    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, now(), v_description, 'POSTED', v_amount_to_reverse, v_amount_to_reverse, 'USD', OLD.id::text)
    RETURNING id INTO v_journal_entry_id;

    -- Crédit 1200 (Diminue créance), Débit 4000 (Diminue revenu)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1200_id, '1200', 'Créances Clients', 0, v_amount_to_reverse, v_description);
    
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_4000_id, '4000', 'Revenus de Location', v_amount_to_reverse, 0, v_description);

    -- Grand Livre
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1200_id, '1200', 'Créances Clients', v_journal_entry_id, v_entry_number, now(), v_description, 0, v_amount_to_reverse, 'USD');
    
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_4000_id, '4000', 'Revenus de Location', v_journal_entry_id, v_entry_number, now(), v_description, v_amount_to_reverse, 0, 'USD');
  END IF;

  -- GESTION DE L'INSERT OU UPDATE (Application de la nouvelle valeur de facture)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_entry_number := 'AUTO-INV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(NEW.id::text, 1, 8) || '-' || substring(gen_random_uuid()::text, 1, 4);
    v_description := 'Facturation auto ' || NEW.invoice_number;

    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, NEW.date, v_description, 'POSTED', NEW.net_total, NEW.net_total, 'USD', NEW.id::text)
    RETURNING id INTO v_journal_entry_id;

    -- Débit 1200 (Augmente créance), Crédit 4000 (Reconnu en revenu)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1200_id, '1200', 'Créances Clients', NEW.net_total, 0, v_description);

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_4000_id, '4000', 'Revenus de Location', 0, NEW.net_total, v_description);

    -- Grand Livre
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1200_id, '1200', 'Créances Clients', v_journal_entry_id, v_entry_number, NEW.date, v_description, NEW.net_total, 0, 'USD');

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_4000_id, '4000', 'Revenus de Location', v_journal_entry_id, v_entry_number, NEW.date, v_description, 0, NEW.net_total, 'USD');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------------
-- 2. MISE À JOUR DE LA COMPTABILISATION DES PAIEMENTS (TRÉSORERIE & SOLDE CRÉANCE)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_payment_accounting_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id UUID;
  v_entry_number VARCHAR(50);
  v_account_1000_id UUID; -- Trésorerie
  v_account_1200_id UUID; -- Créances Clients (Remplace 4000)
  v_description TEXT;
  v_amount_to_reverse DECIMAL;
BEGIN
  SELECT id INTO v_account_1000_id FROM public.accounts WHERE code = '1000' LIMIT 1;
  SELECT id INTO v_account_1200_id FROM public.accounts WHERE code = '1200' LIMIT 1;

  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    -- Si c'est un UPDATE, on ne contrepasse que si le montant a changé
    IF (TG_OP = 'UPDATE' AND OLD.montant = NEW.montant AND OLD.date_paiement = NEW.date_paiement) THEN
       RETURN NEW;
    END IF;

    v_amount_to_reverse := OLD.montant;
    v_entry_number := 'REV-PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substring(OLD.id::text, 1, 8) || '-' || substring(gen_random_uuid()::text, 1, 4);
    v_description := 'Annulation paiement - ' || COALESCE(OLD.notes, 'Auto-rev');

    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, now(), v_description, 'POSTED', v_amount_to_reverse, v_amount_to_reverse, 'USD', OLD.id::text)
    RETURNING id INTO v_journal_entry_id;

    -- Crédit 1000 (Diminue trésorerie), Débit 1200 (Augmente créance car paiement annulé)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1000_id, '1000', 'Trésorerie', 0, v_amount_to_reverse, v_description);
    
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1200_id, '1200', 'Créances Clients', v_amount_to_reverse, 0, v_description);

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1000_id, '1000', 'Trésorerie', v_journal_entry_id, v_entry_number, now(), v_description, 0, v_amount_to_reverse, 'USD');
    
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1200_id, '1200', 'Créances Clients', v_journal_entry_id, v_entry_number, now(), v_description, v_amount_to_reverse, 0, 'USD');
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_entry_number := 'AUTO-PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substring(NEW.id::text, 1, 8) || '-' || substring(gen_random_uuid()::text, 1, 4);
    v_description := 'Encaissement paiement auto';

    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, NEW.date_paiement, v_description, 'POSTED', NEW.montant, NEW.montant, 'USD', NEW.id::text)
    RETURNING id INTO v_journal_entry_id;

    -- Débit 1000 (Augmente trésorerie), Crédit 1200 (Diminue créance client)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1000_id, '1000', 'Trésorerie', NEW.montant, 0, v_description);

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1200_id, '1200', 'Créances Clients', 0, NEW.montant, v_description);

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1000_id, '1000', 'Trésorerie', v_journal_entry_id, v_entry_number, NEW.date_paiement, v_description, NEW.montant, 0, 'USD');

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1200_id, '1200', 'Créances Clients', v_journal_entry_id, v_entry_number, NEW.date_paiement, v_description, 0, NEW.montant, 'USD');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------------
-- 3. ACTIVATION DES TRIGGERS
-------------------------------------------------------------------------------

-- Désactiver puis Réactiver pour Payments
DROP TRIGGER IF EXISTS trg_payment_accounting_automation ON public.payments;
CREATE TRIGGER trg_payment_accounting_automation
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_accounting_automation();

-- Créer pour Invoices
DROP TRIGGER IF EXISTS trg_invoice_accounting_automation ON public.invoices;
CREATE TRIGGER trg_invoice_accounting_automation
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_accounting_automation();
