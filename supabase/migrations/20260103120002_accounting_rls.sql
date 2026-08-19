-- Migration: Sécurité (RLS) Comptabilité
-- Date: 3 janvier 2026

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_ledger ENABLE ROW LEVEL SECURITY;

-- Comptes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Accounts viewable by authenticated users') THEN
    CREATE POLICY "Accounts viewable by authenticated users" ON public.accounts FOR SELECT USING (public.is_authenticated());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Accounts manageable by admin') THEN
    CREATE POLICY "Accounts manageable by admin" ON public.accounts FOR ALL USING (public.has_role('ADMIN'::public.user_role, auth.uid()));
  END IF;
END $$;

-- Écritures
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Journal entries viewable by authenticated users') THEN
    CREATE POLICY "Journal entries viewable by authenticated users" ON public.journal_entries FOR SELECT USING (public.is_authenticated());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Journal entries manageable by admin') THEN
    CREATE POLICY "Journal entries manageable by admin" ON public.journal_entries FOR ALL USING (public.has_role('ADMIN'::public.user_role, auth.uid()));
  END IF;
END $$;

-- Lignes d'écritures
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Journal entry lines viewable by authenticated users') THEN
    CREATE POLICY "Journal entry lines viewable by authenticated users" ON public.journal_entry_lines FOR SELECT USING (public.is_authenticated());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Journal entry lines manageable by admin') THEN
    CREATE POLICY "Journal entry lines manageable by admin" ON public.journal_entry_lines FOR ALL USING (public.has_role('ADMIN'::public.user_role, auth.uid()));
  END IF;
END $$;

-- Grand Livre
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'General ledger viewable by authenticated users') THEN
    CREATE POLICY "General ledger viewable by authenticated users" ON public.general_ledger FOR SELECT USING (public.is_authenticated());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'General ledger manageable by admin') THEN
    CREATE POLICY "General ledger manageable by admin" ON public.general_ledger FOR ALL USING (public.has_role('ADMIN'::public.user_role, auth.uid()));
  END IF;
END $$;
