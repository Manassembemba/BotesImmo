import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Account, JournalEntry, JournalEntryLine, GeneralLedgerEntry, TrialBalance } from '@/interfaces/Accounting';
import { accountingDbService } from '@/services/AccountingDbService';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingDbService.getAccounts(),
  });
}

export function useAccountById(id: string) {
  return useQuery({
    queryKey: ['account', id],
    queryFn: () => accountingDbService.getAccountById(id),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'balance'>) => 
      accountingDbService.createAccount(account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Compte créé',
        description: 'Le compte comptable a été créé avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la création du compte: ${(error as Error).message}`
      });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) => 
      accountingDbService.updateAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
      toast({
        title: 'Compte mis à jour',
        description: 'Le compte comptable a été mis à jour avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la mise à jour du compte: ${(error as Error).message}`
      });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => accountingDbService.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Compte supprimé',
        description: 'Le compte comptable a été supprimé avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la suppression du compte: ${(error as Error).message}`
      });
    },
  });
}

export function useJournalEntries(options?: {
  filters?: { status?: string; dateRange?: { start: string; end: string }; };
  pagination?: { pageIndex: number; pageSize: number; };
}) {
  return useQuery({
    queryKey: ['journal-entries', options],
    queryFn: () => accountingDbService.getJournalEntries(options),
  });
}

export function useJournalEntryById(id: string) {
  return useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => accountingDbService.getJournalEntryById(id),
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ entry, lines }: { entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at' | 'total_debit' | 'total_credit'>; lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id'>[] }) => 
      accountingDbService.createJournalEntry(entry, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({
        title: 'Écriture créée',
        description: 'L\'écriture comptable a été créée avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la création de l'écriture: ${(error as Error).message}`
      });
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, entry, lines }: { id: string; entry: JournalEntry; lines: JournalEntryLine[] }) => 
      accountingDbService.updateJournalEntry(id, entry, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
      toast({
        title: 'Écriture mise à jour',
        description: 'L\'écriture comptable a été mise à jour avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la mise à jour de l'écriture: ${(error as Error).message}`
      });
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => accountingDbService.deleteJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({
        title: 'Écriture supprimée',
        description: 'L\'écriture comptable a été supprimée avec succès.'
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la suppression de l'écriture: ${(error as Error).message}`
      });
    },
  });
}

export function useGeneralLedger(options?: {
  filters?: { 
    dateRange?: { start: string; end: string }; 
    accountIds?: string[]; 
    search?: string; 
  };
  pagination?: { pageIndex: number; pageSize: number; };
}) {
  return useQuery({
    queryKey: ['general-ledger', options],
    queryFn: () => accountingDbService.getGeneralLedger(options),
  });
}

export function useTrialBalance(dateRange: { start: string; end: string }) {
  return useQuery({
    queryKey: ['trial-balance', dateRange],
    queryFn: () => accountingDbService.getTrialBalance(dateRange),
  });
}