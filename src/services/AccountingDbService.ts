import { Account, JournalEntry, JournalEntryLine, GeneralLedgerEntry } from '@/interfaces/Accounting';
import { supabase } from '@/integrations/supabase/client';

export const accountingDbService = {
  // Accounts
  getAccounts: async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;
    return data as Account[];
  },

  getAccountById: async (id: string) => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Account;
  },

  createAccount: async (account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'balance'>) => {
    const { data, error } = await supabase
      .from('accounts')
      .insert([{
        code: account.code,
        name: account.name,
        type: account.type,
        category: account.category,
        description: account.description,
        parent_id: account.parent_id,
        currency: account.currency
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Account;
  },

  updateAccount: async (id: string, updates: Partial<Account>) => {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Account;
  },

  deleteAccount: async (id: string) => {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Journal Entries
  getJournalEntries: async (options?: {
    filters?: { status?: string; dateRange?: { start: string; end: string }; };
    pagination?: { pageIndex: number; pageSize: number; };
  }) => {
    const { filters, pagination = { pageIndex: 0, pageSize: 50 } } = options || {};
    const { pageIndex, pageSize } = pagination;
    const rangeFrom = pageIndex * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        lines (*)
      `, { count: 'exact' })
      .order('date', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.dateRange?.start && filters?.dateRange?.end) {
      query = query.gte('date', filters.dateRange.start);
      query = query.lte('date', filters.dateRange.end);
    }

    query = query.range(rangeFrom, rangeTo);

    const { data, error, count } = await query;

    if (error) throw error;

    const formattedData = (data || []).map((row: any) => ({
      id: row.id,
      entry_number: row.entry_number,
      date: row.date,
      description: row.description,
      reference: row.reference,
      status: row.status as 'DRAFT' | 'POSTED' | 'REVERSED',
      total_debit: Number(row.total_debit || 0),
      total_credit: Number(row.total_credit || 0),
      currency: row.currency,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      lines: (row.lines || []).map((line: any) => ({
        id: line.id,
        journal_entry_id: line.journal_entry_id,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        description: line.description,
        reference: line.reference
      }))
    }));

    return { data: formattedData, count: count ?? 0 };
  },

  getJournalEntryById: async (id: string) => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      entry_number: data.entry_number,
      date: data.date,
      description: data.description,
      reference: data.reference,
      status: data.status as 'DRAFT' | 'POSTED' | 'REVERSED',
      total_debit: Number(data.total_debit || 0),
      total_credit: Number(data.total_credit || 0),
      currency: data.currency,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      lines: (data.lines || []).map((line: any) => ({
        id: line.id,
        journal_entry_id: line.journal_entry_id,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        description: line.description,
        reference: line.reference
      }))
    } as JournalEntry;
  },

  createJournalEntry: async (entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at' | 'total_debit' | 'total_credit'>, lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id'>[]) => {
    // Calculate totals
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    // Verify that the entry is balanced
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('L\'écriture comptable n\'est pas équilibrée. Le total des débits doit être égal au total des crédits.');
    }

    // Insert journal entry
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .insert([{
        entry_number: entry.entry_number,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        total_debit: totalDebit,
        total_credit: totalCredit,
        currency: entry.currency
      }])
      .select()
      .single();

    if (entryError) throw entryError;

    // Insert journal entry lines
    const linesToInsert = lines.map(line => ({
      ...line,
      journal_entry_id: entryData.id,
      account_code: line.account_code,
      account_name: line.account_name
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesToInsert);

    if (linesError) throw linesError;

    // Update account balances
    for (const line of lines) {
      await supabase.rpc('update_account_balance', {
        p_account_id: line.account_id,
        p_amount: (line.debit || 0) - (line.credit || 0)
      });
    }

    // Create general ledger entries
    const ledgerEntries = lines.map(line => ({
      account_id: line.account_id,
      account_code: line.account_code,
      account_name: line.account_name,
      journal_entry_id: entryData.id,
      journal_entry_number: entry.entry_number,
      date: entry.date,
      description: entry.description,
      debit: line.debit,
      credit: line.credit,
      currency: entry.currency
    }));

    const { error: ledgerError } = await supabase
      .from('general_ledger')
      .insert(ledgerEntries);

    if (ledgerError) throw ledgerError;

    return { ...entryData, lines: linesToInsert };
  },

  updateJournalEntry: async (id: string, entry: JournalEntry, lines: JournalEntryLine[]) => {
    // Calculate totals
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    // Verify that the entry is balanced
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('L\'écriture comptable n\'est pas équilibrée. Le total des débits doit être égal au total des crédits.');
    }

    // Update journal entry
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .update({
        entry_number: entry.entry_number,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        total_debit: totalDebit,
        total_credit: totalCredit,
        currency: entry.currency
      })
      .eq('id', id)
      .select()
      .single();

    if (entryError) throw entryError;

    // Delete existing lines
    await supabase
      .from('journal_entry_lines')
      .delete()
      .eq('journal_entry_id', id);

    // Insert updated lines
    const linesToInsert = lines.map(line => ({
      ...line,
      journal_entry_id: id,
      account_code: line.account_code,
      account_name: line.account_name
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesToInsert);

    if (linesError) throw linesError;

    // Update account balances (reverse old balances and add new ones)
    // This is a simplified approach - in a real system you'd need to handle this more carefully
    // For now, we'll just recreate the general ledger entries
    await supabase
      .from('general_ledger')
      .delete()
      .eq('journal_entry_id', id);

    // Create new general ledger entries
    const ledgerEntries = lines.map(line => ({
      account_id: line.account_id,
      account_code: line.account_code,
      account_name: line.account_name,
      journal_entry_id: id,
      journal_entry_number: entry.entry_number,
      date: entry.date,
      description: entry.description,
      debit: line.debit,
      credit: line.credit,
      currency: entry.currency
    }));

    const { error: ledgerError } = await supabase
      .from('general_ledger')
      .insert(ledgerEntries);

    if (ledgerError) throw ledgerError;

    return { ...entryData, lines: linesToInsert };
  },

  deleteJournalEntry: async (id: string) => {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // General Ledger
  getGeneralLedger: async (options?: {
    filters?: { 
      dateRange?: { start: string; end: string }; 
      accountIds?: string[]; 
      search?: string; 
    };
    pagination?: { pageIndex: number; pageSize: number; };
  }) => {
    const { filters, pagination = { pageIndex: 0, pageSize: 50 } } = options || {};
    const { pageIndex, pageSize } = pagination;
    const rangeFrom = pageIndex * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
      .from('general_ledger')
      .select(`
        *,
        accounts (code, name)
      `, { count: 'exact' })
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (filters?.dateRange?.start && filters?.dateRange?.end) {
      query = query.gte('date', filters.dateRange.start);
      query = query.lte('date', filters.dateRange.end);
    }

    if (filters?.accountIds && filters.accountIds.length > 0) {
      query = query.in('account_id', filters.accountIds);
    }

    if (filters?.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      query = query.or(`description.ilike.${search},accounts.name.ilike.${search},accounts.code.ilike.${search}`);
    }

    query = query.range(rangeFrom, rangeTo);

    const { data, error, count } = await query;

    if (error) throw error;

    // Calculate running balance
    let runningBalance = 0;
    const formattedData = (data || []).map((row: any) => {
      runningBalance += (row.debit || 0) - (row.credit || 0);
      return {
        id: row.id,
        account_id: row.account_id,
        account_code: row.accounts?.code || row.account_code,
        account_name: row.accounts?.name || row.account_name,
        journal_entry_id: row.journal_entry_id,
        journal_entry_number: row.journal_entry_number,
        date: row.date,
        description: row.description,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        balance: Number(row.balance || 0),
        running_balance: runningBalance,
        currency: row.currency
      };
    });

    return { data: formattedData, count: count ?? 0 };
  },

  getTrialBalance: async (dateRange: { start: string; end: string }) => {
    // This would typically be calculated from the general ledger
    // For now, we'll return a placeholder implementation
    const { data, error } = await supabase
      .from('general_ledger')
      .select(`
        account_id,
        accounts (code, name, type),
        sum(debit) as total_debits,
        sum(credit) as total_credits
      `)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .group('account_id, accounts');

    if (error) throw error;

    // Calculate trial balance
    const trialBalance = (data || []).map((row: any) => {
      const totalDebits = parseFloat(row.total_debits) || 0;
      const totalCredits = parseFloat(row.total_credits) || 0;
      const closingBalance = totalDebits - totalCredits;

      return {
        account_id: row.account_id,
        account_code: row.accounts?.code,
        account_name: row.accounts?.name,
        opening_balance: 0, // Would need to calculate from previous period
        total_debits: totalDebits,
        total_credits: totalCredits,
        closing_balance: closingBalance,
        currency: 'USD'
      };
    });

    return trialBalance;
  }
};