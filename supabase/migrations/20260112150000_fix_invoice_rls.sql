-- Migration: Secure Invoice RLS Policies
-- Date: 2026-01-12
-- Description: Drops insecure and redundant policies, leaving only the location-scoped policy.

-- 1. Drop the CRITICAL insecurity: a policy that allowed SELECT (Using true) for everyone
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.invoices;

-- 2. Drop redundant legacy policies that might conflict or confuse logic
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;

-- 3. Ensure the location-based policy is the primary one (it should already exist from previous migrations)
-- We do not need to recreate "Allow access to invoices based on user location" as we saw it active in the db inspection.
