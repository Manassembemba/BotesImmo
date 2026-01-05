-- Migration: Tables de comptabilité
-- Date: 3 janvier 2026

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  category VARCHAR(50),
  description TEXT,
  parent_id UUID REFERENCES public.accounts(id),
  balance DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  total_debit DECIMAL(15, 2) DEFAULT 0,
  total_credit DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  reference VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.general_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  journal_entry_number VARCHAR(50),
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2) DEFAULT 0,
  running_balance DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
