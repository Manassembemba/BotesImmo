-- Migration: Automatisation comptable (Trigger Paiements)
-- Date: 3 janvier 2026

CREATE OR REPLACE FUNCTION public.handle_payment_accounting_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id UUID;
  v_entry_number VARCHAR(50);
  v_account_1000_id UUID;
  v_account_4000_id UUID;
  v_description TEXT;
  v_amount_to_reverse DECIMAL;
BEGIN
  -- Récupérer les ID des comptes standard
  SELECT id INTO v_account_1000_id FROM public.accounts WHERE code = '1000' LIMIT 1;
  SELECT id INTO v_account_4000_id FROM public.accounts WHERE code = '4000' LIMIT 1;

  -- GESTION DU DELETE OU UPDATE (Contrepassement de l'ancienne valeur)
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    v_amount_to_reverse := OLD.montant;
    v_entry_number := 'REV-PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substring(OLD.id::text, 1, 8);
    v_description := 'Annulation/Modif paiement - ' || COALESCE(OLD.notes, 'Auto-rev');

    -- Insertion de l'écriture de contrepassement
    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, now(), v_description, 'POSTED', v_amount_to_reverse, v_amount_to_reverse, 'USD', OLD.id::text)
    RETURNING id INTO v_journal_entry_id;

    -- Inverse du paiement initial: Crédit 1000, Débit 4000
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1000_id, '1000', 'Trésorerie', 0, v_amount_to_reverse, v_description);
    
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_4000_id, '4000', 'Revenus de Location', v_amount_to_reverse, 0, v_description);

    -- Grand Livre
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1000_id, '1000', 'Trésorerie', v_journal_entry_id, v_entry_number, now(), v_description, 0, v_amount_to_reverse, 'USD');
    
    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_4000_id, '4000', 'Revenus de Location', v_journal_entry_id, v_entry_number, now(), v_description, v_amount_to_reverse, 0, 'USD');
  END IF;

  -- GESTION DE L'INSERT OU UPDATE (Application de la nouvelle valeur)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_entry_number := 'AUTO-PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substring(NEW.id::text, 1, 8);
    v_description := 'Paiement auto - ' || COALESCE(NEW.notes, 'Sans note');

    INSERT INTO public.journal_entries (entry_number, date, description, status, total_debit, total_credit, currency, reference)
    VALUES (v_entry_number, NEW.date_paiement, v_description, 'POSTED', NEW.montant, NEW.montant, 'USD', NEW.id::text)
    RETURNING id INTO v_journal_entry_id;

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_1000_id, '1000', 'Trésorerie', NEW.montant, 0, v_description);

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, description)
    VALUES (v_journal_entry_id, v_account_4000_id, '4000', 'Revenus de Location', 0, NEW.montant, v_description);

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_1000_id, '1000', 'Trésorerie', v_journal_entry_id, v_entry_number, NEW.date_paiement, v_description, NEW.montant, 0, 'USD');

    INSERT INTO public.general_ledger (account_id, account_code, account_name, journal_entry_id, journal_entry_number, date, description, debit, credit, currency)
    VALUES (v_account_4000_id, '4000', 'Revenus de Location', v_journal_entry_id, v_entry_number, NEW.date_paiement, v_description, 0, NEW.montant, 'USD');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attacher le trigger
DROP TRIGGER IF EXISTS trg_payment_accounting_automation ON public.payments;
CREATE TRIGGER trg_payment_accounting_automation
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_accounting_automation();
