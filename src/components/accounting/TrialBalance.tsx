import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { TrialBalance } from '@/interfaces/Accounting';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface TrialBalanceFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const TrialBalanceReport = () => {
  const [filters, setFilters] = useState<TrialBalanceFilter>({
    dateRange: { 
      start: format(new Date(), 'yyyy-MM-dd'), 
      end: format(new Date(), 'yyyy-MM-dd') 
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch trial balance data
  const { data: trialBalance = [], isLoading } = useQuery({
    queryKey: ['trial-balance', filters],
    queryFn: async () => {
      // This would typically be calculated from the general ledger
      // For now, we'll simulate the data based on existing transactions
      let query = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name, type),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .group('account_id, accounts');

      if (filters.accountIds && filters.accountIds.length > 0) {
        query = query.in('account_id', filters.accountIds);
      }

      if (filters.search) {
        const search = `%${filters.search.toLowerCase()}%`;
        query = query.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate opening balances and closing balances
      const result: TrialBalance[] = (data || []).map((row: any) => {
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

      return result;
    },
  });

  // Calculate totals
  const totals = useMemo(() => {
    return trialBalance.reduce((acc, account) => {
      acc.totalDebits += account.total_debits;
      acc.totalCredits += account.total_credits;
      acc.totalClosing += account.closing_balance;
      return acc;
    }, { totalDebits: 0, totalCredits: 0, totalClosing: 0 });
  }, [trialBalance]);

  // Group by account type
  const groupedByType = useMemo(() => {
    const grouped: Record<string, TrialBalance[]> = {
      'ASSET': [],
      'LIABILITY': [],
      'EQUITY': [],
      'REVENUE': [],
      'EXPENSE': []
    };

    trialBalance.forEach(account => {
      if (account.account_code && account.account_code.startsWith('1')) {
        grouped['ASSET'].push(account);
      } else if (account.account_code && account.account_code.startsWith('2')) {
        grouped['LIABILITY'].push(account);
      } else if (account.account_code && account.account_code.startsWith('3')) {
        grouped['EQUITY'].push(account);
      } else if (account.account_code && account.account_code.startsWith('4')) {
        grouped['REVENUE'].push(account);
      } else if (account.account_code && account.account_code.startsWith('5')) {
        grouped['EXPENSE'].push(account);
      } else {
        // Default to asset if no clear classification
        grouped['ASSET'].push(account);
      }
    });

    return grouped;
  }, [trialBalance]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const headers = [
        "Code Compte", "Nom Compte", "Solde Ouverture", "Total Débits", "Total Crédits", "Solde Clôture"
      ];
      
      const rows = trialBalance.map(account => [
        account.account_code,
        account.account_name,
        account.opening_balance.toFixed(2),
        account.total_debits.toFixed(2),
        account.total_credits.toFixed(2),
        account.closing_balance.toFixed(2)
      ]);
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `balance-tiède_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout title="Balance de Vérification" subtitle="Rapport qui vérifie l'équilibre des comptes">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Balance de Vérification</h2>
            <Badge variant="outline">{trialBalance.length} comptes</Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Débits</p>
            <h3 className="text-lg font-bold text-red-600">
              <CurrencyDisplay amountUSD={totals.totalDebits} />
            </h3>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Crédits</p>
            <h3 className="text-lg font-bold text-green-600">
              <CurrencyDisplay amountUSD={totals.totalCredits} />
            </h3>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Différence</p>
            <h3 className={`text-lg font-bold ${Math.abs(totals.totalClosing) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              <CurrencyDisplay amountUSD={totals.totalClosing} />
            </h3>
          </div>
        </div>

        {/* Trial Balance by Account Type */}
        {Object.entries(groupedByType).map(([type, accounts]) => {
          if (accounts.length === 0) return null;
          
          // Calculate subtotals for this type
          const subtotals = accounts.reduce((acc, account) => {
            acc.totalDebits += account.total_debits;
            acc.totalCredits += account.total_credits;
            acc.totalClosing += account.closing_balance;
            return acc;
          }, { totalDebits: 0, totalCredits: 0, totalClosing: 0 });
          
          return (
            <div key={type} className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold capitalize">{type.toLowerCase()}</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">CODE</TableHead>
                    <TableHead>LIBELLE</TableHead>
                    <TableHead className="text-right w-[120px]">SOLDE OUVERTURE</TableHead>
                    <TableHead className="text-right w-[120px]">TOTAL DEBIT</TableHead>
                    <TableHead className="text-right w-[120px]">TOTAL CREDIT</TableHead>
                    <TableHead className="text-right w-[120px]">SOLDE CLOTURE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.account_id}>
                      <TableCell className="font-medium">{account.account_code}</TableCell>
                      <TableCell>{account.account_name}</TableCell>
                      <TableCell className="text-right">
                        {account.opening_balance.toFixed(2)} {account.currency}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {account.total_debits.toFixed(2)} {account.currency}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {account.total_credits.toFixed(2)} {account.currency}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${account.closing_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {account.closing_balance.toFixed(2)} {account.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2}>Sous-total</TableCell>
                    <TableCell className="text-right">0.00 USD</TableCell>
                    <TableCell className="text-right text-red-600">{subtotals.totalDebits.toFixed(2)} USD</TableCell>
                    <TableCell className="text-right text-green-600">{subtotals.totalCredits.toFixed(2)} USD</TableCell>
                    <TableCell className={`text-right ${subtotals.totalClosing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {subtotals.totalClosing.toFixed(2)} USD
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })}

        {/* Grand Total */}
        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <Table>
            <TableBody>
              <TableRow className="font-bold text-lg">
                <TableCell className="text-right">TOTAL GÉNÉRAL</TableCell>
                <TableCell className="text-right text-red-600">{totals.totalDebits.toFixed(2)} USD</TableCell>
                <TableCell className="text-right text-green-600">{totals.totalCredits.toFixed(2)} USD</TableCell>
                <TableCell className={`text-right ${Math.abs(totals.totalClosing) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.totalClosing.toFixed(2)} USD
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Validation Message */}
        <div className={`p-4 rounded-lg border ${Math.abs(totals.totalClosing) < 0.01 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${Math.abs(totals.totalClosing) < 0.01 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>
              {Math.abs(totals.totalClosing) < 0.01 
                ? "✅ La balance de vérification est équilibrée. La somme des débits égale la somme des crédits." 
                : `⚠️ La balance de vérification n'est pas équilibrée. Différence de ${Math.abs(totals.totalClosing).toFixed(2)} USD.`}
            </span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TrialBalanceReport;