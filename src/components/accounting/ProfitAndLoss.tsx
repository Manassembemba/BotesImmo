import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { ProfitAndLoss } from '@/interfaces/Accounting';
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

interface ProfitAndLossFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const ProfitAndLossStatement = () => {
  const [filters, setFilters] = useState<ProfitAndLossFilter>({
    dateRange: { 
      start: format(new Date(), 'yyyy-MM-dd'), 
      end: format(new Date(), 'yyyy-MM-dd') 
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch profit and loss data
  const { data: pAndL, isLoading } = useQuery({
    queryKey: ['profit-loss', filters],
    queryFn: async () => {
      // This would typically be calculated from the general ledger
      // For now, we'll simulate the data based on existing transactions
      let revenueQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .or('accounts.code.ilike.4%,accounts.code.ilike.5%') // Revenue accounts typically start with 4 or 5
        .group('account_id, accounts');

      let expenseQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .or('accounts.code.ilike.6%,accounts.code.ilike.7%') // Expense accounts typically start with 6 or 7
        .group('account_id, accounts');

      if (filters.accountIds && filters.accountIds.length > 0) {
        revenueQuery = revenueQuery.in('account_id', filters.accountIds);
        expenseQuery = expenseQuery.in('account_id', filters.accountIds);
      }

      if (filters.search) {
        const search = `%${filters.search.toLowerCase()}%`;
        revenueQuery = revenueQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
        expenseQuery = expenseQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
      }

      const [revenueResult, expenseResult] = await Promise.all([
        revenueQuery,
        expenseQuery
      ]);

      if (revenueResult.error) throw revenueResult.error;
      if (expenseResult.error) throw expenseResult.error;

      // Process revenue data
      const revenue = (revenueResult.data || []).map((row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        // For revenue accounts, credits increase revenue
        const amount = totalCredits - totalDebits;
        return {
          account_code: row.accounts?.code,
          account_name: row.accounts?.name,
          amount: amount > 0 ? amount : 0
        };
      }).filter(item => item.amount > 0);

      // Process expense data
      const expenses = (expenseResult.data || []).map((row: any) => {
        const totalDebits = parseFloat(row.total_debits) || 0;
        const totalCredits = parseFloat(row.total_credits) || 0;
        // For expense accounts, debits increase expenses
        const amount = totalDebits - totalCredits;
        return {
          account_code: row.accounts?.code,
          account_name: row.accounts?.name,
          amount: amount > 0 ? amount : 0
        };
      }).filter(item => item.amount > 0);

      // Calculate totals
      const totalRevenue = revenue.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
      const netIncome = totalRevenue - totalExpenses;

      return {
        revenue,
        expenses,
        net_income: netIncome,
        currency: 'USD'
      };
    },
  });

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv' && pAndL) {
      const headers = [
        "Type", "Compte", "Montant"
      ];
      
      const rows = [
        ...pAndL.revenue.map(item => ["Revenu", `${item.account_code} - ${item.account_name}`, item.amount.toFixed(2)]),
        ["", "TOTAL REVENUS", pAndL.revenue.reduce((sum, item) => sum + item.amount, 0).toFixed(2)],
        ...pAndL.expenses.map(item => ["Dépense", `${item.account_code} - ${item.account_name}`, item.amount.toFixed(2)]),
        ["", "TOTAL DEPENSES", pAndL.expenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2)],
        ["", "RÉSULTAT NET", pAndL.net_income.toFixed(2)]
      ];
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `compte-resultat_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout title="Compte de Résultat" subtitle="Rapport montrant les revenus, dépenses et profit/net">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Compte de Résultat</h2>
            <Badge variant="outline">Période: {format(new Date(filters.dateRange.start), 'dd/MM/yyyy')} - {format(new Date(filters.dateRange.end), 'dd/MM/yyyy')}</Badge>
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

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Chargement du compte de résultat...</p>
          </div>
        ) : pAndL ? (
          <div className="space-y-8">
            {/* Revenue Section */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">REVENUS</h3>
              </div>
              <Table>
                <TableBody>
                  {pAndL.revenue.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium w-1/3">{item.account_code}</TableCell>
                      <TableCell className="w-2/3">{item.account_name}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        <CurrencyDisplay amountUSD={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-right">TOTAL DES REVENUS</TableCell>
                    <TableCell className="text-right text-green-600">
                      <CurrencyDisplay amountUSD={pAndL.revenue.reduce((sum, item) => sum + item.amount, 0)} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Expenses Section */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">DÉPENSES</h3>
              </div>
              <Table>
                <TableBody>
                  {pAndL.expenses.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium w-1/3">{item.account_code}</TableCell>
                      <TableCell className="w-2/3">{item.account_name}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        <CurrencyDisplay amountUSD={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-right">TOTAL DES DÉPENSES</TableCell>
                    <TableCell className="text-right text-red-600">
                      <CurrencyDisplay amountUSD={pAndL.expenses.reduce((sum, item) => sum + item.amount, 0)} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Net Income Calculation */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow className="font-bold">
                    <TableCell className="text-right text-lg">RÉSULTAT NET</TableCell>
                    <TableCell className="text-right text-lg">
                      <span className={pAndL.net_income >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={pAndL.net_income} />
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Revenus</p>
                <h3 className="text-lg font-bold text-green-600">
                  <CurrencyDisplay amountUSD={pAndL.revenue.reduce((sum, item) => sum + item.amount, 0)} />
                </h3>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Dépenses</p>
                <h3 className="text-lg font-bold text-red-600">
                  <CurrencyDisplay amountUSD={pAndL.expenses.reduce((sum, item) => sum + item.amount, 0)} />
                </h3>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Résultat Net</p>
                <h3 className={`text-lg font-bold ${pAndL.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={pAndL.net_income} />
                </h3>
              </div>
            </div>

            {/* Result Analysis */}
            <div className={`p-4 rounded-lg border ${pAndL.net_income >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${pAndL.net_income >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>
                  {pAndL.net_income >= 0 
                    ? `Félicitations ! L'entreprise a réalisé un bénéfice net de ${formatCurrency(pAndL.net_income, rate).usd} pendant cette période.` 
                    : `L'entreprise a subi une perte nette de ${formatCurrency(Math.abs(pAndL.net_income), rate).usd} pendant cette période. Il serait judicieux d'analyser les dépenses importantes.`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Aucune donnée disponible pour cette période.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ProfitAndLossStatement;