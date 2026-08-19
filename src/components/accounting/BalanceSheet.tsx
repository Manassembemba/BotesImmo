import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { BalanceSheet } from '@/interfaces/Accounting';
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

interface BalanceSheetFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const BalanceSheetReport = () => {
  const [filters, setFilters] = useState<BalanceSheetFilter>({
    dateRange: { 
      start: format(new Date(), 'yyyy-MM-dd'), 
      end: format(new Date(), 'yyyy-MM-dd') 
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch balance sheet data
  const { data: balanceSheet, isLoading } = useQuery({
    queryKey: ['balance-sheet', filters],
    queryFn: async () => {
      // This would typically be calculated from the general ledger with opening balances
      // For now, we'll simulate the data based on existing transactions
      let assetQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.1%,accounts.code.ilike.2%') // Asset accounts typically start with 1 or 2
        .group('account_id, accounts');

      let liabilityQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.2%,accounts.code.ilike.3%') // Liability accounts typically start with 2 or 3
        .group('account_id, accounts');

      let equityQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.3%') // Equity accounts typically start with 3
        .group('account_id, accounts');

      if (filters.accountIds && filters.accountIds.length > 0) {
        assetQuery = assetQuery.in('account_id', filters.accountIds);
        liabilityQuery = liabilityQuery.in('account_id', filters.accountIds);
        equityQuery = equityQuery.in('account_id', filters.accountIds);
      }

      if (filters.search) {
        const search = `%${filters.search.toLowerCase()}%`;
        assetQuery = assetQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
        liabilityQuery = liabilityQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
        equityQuery = equityQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
      }

      const [assetResult, liabilityResult, equityResult] = await Promise.all([
        assetQuery,
        liabilityQuery,
        equityQuery
      ]);

      if (assetResult.error) throw assetResult.error;
      if (liabilityResult.error) throw liabilityResult.error;
      if (equityResult.error) throw equityResult.error;

      // Process asset data
      const assets = (assetResult.data || []).map((row: any) => {
        const totalDebits = parseFloat(row.total_debits) || 0;
        const totalCredits = parseFloat(row.total_credits) || 0;
        // For asset accounts, debits increase the balance
        const amount = totalDebits - totalCredits;
        return {
          account_code: row.accounts?.code,
          account_name: row.accounts?.name,
          amount: amount > 0 ? amount : 0
        };
      }).filter(item => item.amount > 0);

      // Process liability data
      const liabilities = (liabilityResult.data || []).map((row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        // For liability accounts, credits increase the balance
        const amount = totalCredits - totalDebits;
        return {
          account_code: row.accounts?.code,
          account_name: row.accounts?.name,
          amount: amount > 0 ? amount : 0
        };
      }).filter(item => item.amount > 0);

      // Process equity data
      const equity = (equityResult.data || []).map((row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        // For equity accounts, credits increase the balance
        const amount = totalCredits - totalDebits;
        return {
          account_code: row.accounts?.code,
          account_name: row.accounts?.name,
          amount: amount > 0 ? amount : 0
        };
      }).filter(item => item.amount > 0);

      // Calculate totals
      const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
      const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
      const totalEquity = equity.reduce((sum, item) => sum + item.amount, 0);

      return {
        assets,
        liabilities,
        equity,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        currency: 'USD'
      };
    },
  });

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv' && balanceSheet) {
      const headers = [
        "Section", "Type", "Compte", "Montant"
      ];
      
      const rows = [
        ...balanceSheet.assets.map(item => ["ACTIF", "Actif Courant", `${item.account_code} - ${item.account_name}`, item.amount.toFixed(2)]),
        ["ACTIF", "TOTAL ACTIF", "", balanceSheet.total_assets.toFixed(2)],
        ...balanceSheet.liabilities.map(item => ["PASSIF", "Passif Courant", `${item.account_code} - ${item.account_name}`, item.amount.toFixed(2)]),
        ...balanceSheet.equity.map(item => ["PASSIF", "Capitaux Propres", `${item.account_code} - ${item.account_name}`, item.amount.toFixed(2)]),
        ["PASSIF", "TOTAL PASSIF + CAPITAUX PROPRES", "", (balanceSheet.total_liabilities + balanceSheet.total_equity).toFixed(2)]
      ];
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `bilan-comptable_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout title="Bilan Comptable" subtitle="Rapport montrant les actifs, passifs et capitaux propres">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bilan Comptable</h2>
            <Badge variant="outline">Au {format(new Date(filters.dateRange.end), 'dd/MM/yyyy')}</Badge>
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
            <p className="text-muted-foreground">Chargement du bilan comptable...</p>
          </div>
        ) : balanceSheet ? (
          <div className="space-y-8">
            {/* Assets Section */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">ACTIF</h3>
              </div>
              <Table>
                <TableBody>
                  {balanceSheet.assets.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium w-1/3">{item.account_code}</TableCell>
                      <TableCell className="w-2/3">{item.account_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        <CurrencyDisplay amountUSD={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-right">TOTAL ACTIF</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amountUSD={balanceSheet.total_assets} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Liabilities and Equity Section */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">PASSIF ET CAPITAUX PROPRES</h3>
              </div>
              <Table>
                <TableBody>
                  {/* Liabilities */}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold bg-muted/20">PASSIF</TableCell>
                  </TableRow>
                  {balanceSheet.liabilities.map((item, index) => (
                    <TableRow key={`liab-${index}`}>
                      <TableCell className="font-medium w-1/3">{item.account_code}</TableCell>
                      <TableCell className="w-2/3">{item.account_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        <CurrencyDisplay amountUSD={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2} className="text-right">TOTAL PASSIF</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amountUSD={balanceSheet.total_liabilities} />
                    </TableCell>
                  </TableRow>

                  {/* Equity */}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold bg-muted/20 mt-2">CAPITAUX PROPRES</TableCell>
                  </TableRow>
                  {balanceSheet.equity.map((item, index) => (
                    <TableRow key={`equity-${index}`}>
                      <TableCell className="font-medium w-1/3">{item.account_code}</TableCell>
                      <TableCell className="w-2/3">{item.account_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        <CurrencyDisplay amountUSD={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2} className="text-right">TOTAL CAPITAUX PROPRES</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amountUSD={balanceSheet.total_equity} />
                    </TableCell>
                  </TableRow>

                  {/* Total Liabilities and Equity */}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-right">TOTAL PASSIF + CAPITAUX PROPRES</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amountUSD={balanceSheet.total_liabilities + balanceSheet.total_equity} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Balance Verification */}
            <div className={`p-4 rounded-lg border ${Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)) < 0.01 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`h-3 w-3 rounded-full mr-2 ${Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)) < 0.01 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>
                    {Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)) < 0.01 
                      ? "✅ Le bilan est équilibré. Actif = Passif + Capitaux Propres." 
                      : `⚠️ Le bilan n'est pas équilibré. Différence de ${Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)).toFixed(2)} USD.`}
                  </span>
                </div>
                <div className="text-right font-medium">
                  <div>Actif: <CurrencyDisplay amountUSD={balanceSheet.total_assets} /></div>
                  <div>Passif + Capitaux Propres: <CurrencyDisplay amountUSD={balanceSheet.total_liabilities + balanceSheet.total_equity} /></div>
                </div>
              </div>
            </div>

            {/* Financial Ratios */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Ratios Financiers</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Rapport d'endettement</p>
                  <h3 className="text-lg font-bold">
                    {balanceSheet.total_liabilities > 0 && (balanceSheet.total_assets > 0) 
                      ? (balanceSheet.total_liabilities / balanceSheet.total_assets * 100).toFixed(2) 
                      : '0.00'}%
                  </h3>
                  <p className="text-xs text-muted-foreground">Passif / Actif</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Rapport de liquidité</p>
                  <h3 className="text-lg font-bold">
                    {balanceSheet.total_liabilities > 0 
                      ? (balanceSheet.total_assets / balanceSheet.total_liabilities).toFixed(2) 
                      : '∞'}
                  </h3>
                  <p className="text-xs text-muted-foreground">Actif / Passif</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Capitaux propres</p>
                  <h3 className="text-lg font-bold">
                    <CurrencyDisplay amountUSD={balanceSheet.total_equity} />
                  </h3>
                  <p className="text-xs text-muted-foreground">Valeur nette de l'entreprise</p>
                </div>
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

export default BalanceSheetReport;