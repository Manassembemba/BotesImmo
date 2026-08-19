import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { CashFlowStatement } from '@/interfaces/Accounting';
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

interface CashFlowFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const CashFlowStatement = () => {
  const [filters, setFilters] = useState<CashFlowFilter>({
    dateRange: { 
      start: format(new Date(), 'yyyy-MM-dd'), 
      end: format(new Date(), 'yyyy-MM-dd') 
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch cash flow data
  const { data: cashFlow, isLoading } = useQuery({
    queryKey: ['cash-flow', filters],
    queryFn: async () => {
      // This would typically be calculated from cash-related accounts in the general ledger
      // For now, we'll simulate the data based on existing transactions
      let operatingQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.11%,accounts.code.ilike.12%') // Cash accounts typically start with 11 or 12
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .group('account_id, accounts');

      let investingQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.15%,accounts.code.ilike.16%') // Investment accounts typically start with 15 or 16
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .group('account_id, accounts');

      let financingQuery = supabase
        .from('general_ledger')
        .select(`
          account_id,
          accounts (code, name),
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.21%,accounts.code.ilike.22%') // Financing accounts typically start with 21 or 22
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .group('account_id, accounts');

      if (filters.accountIds && filters.accountIds.length > 0) {
        operatingQuery = operatingQuery.in('account_id', filters.accountIds);
        investingQuery = investingQuery.in('account_id', filters.accountIds);
        financingQuery = financingQuery.in('account_id', filters.accountIds);
      }

      if (filters.search) {
        const search = `%${filters.search.toLowerCase()}%`;
        operatingQuery = operatingQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
        investingQuery = investingQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
        financingQuery = financingQuery.or(`accounts.name.ilike.${search},accounts.code.ilike.${search}`);
      }

      const [operatingResult, investingResult, financingResult] = await Promise.all([
        operatingQuery,
        investingQuery,
        financingQuery
      ]);

      if (operatingResult.error) throw operatingResult.error;
      if (investingResult.error) throw investingResult.error;
      if (financingResult.error) throw financingResult.error;

      // Calculate operating activities (simplified)
      const operatingActivities = (operatingResult.data || []).reduce((sum, row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        // For cash accounts, credits typically represent cash outflows and debits represent inflows
        return sum + (totalDebits - totalCredits);
      }, 0);

      // Calculate investing activities (simplified)
      const investingActivities = (investingResult.data || []).reduce((sum, row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        return sum + (totalDebits - totalCredits);
      }, 0);

      // Calculate financing activities (simplified)
      const financingActivities = (financingResult.data || []).reduce((sum, row: any) => {
        const totalCredits = parseFloat(row.total_credits) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        return sum + (totalDebits - totalCredits);
      }, 0);

      // Calculate net cash flow
      const netCashFlow = operatingActivities + investingActivities + financingActivities;

      // For opening and closing cash balances, we would need to calculate from historical data
      // For now, we'll use placeholder values
      const openingCashBalance = 10000; // This would come from previous period
      const closingCashBalance = openingCashBalance + netCashFlow;

      return {
        operating_activities: operatingActivities,
        investing_activities: investingActivities,
        financing_activities: financingActivities,
        net_cash_flow: netCashFlow,
        opening_cash_balance: openingCashBalance,
        closing_cash_balance: closingCashBalance,
        currency: 'USD'
      };
    },
  });

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv' && cashFlow) {
      const headers = [
        "Activité", "Montant"
      ];
      
      const rows = [
        ["Activités d'exploitation", cashFlow.operating_activities.toFixed(2)],
        ["Activités d'investissement", cashFlow.investing_activities.toFixed(2)],
        ["Activités de financement", cashFlow.financing_activities.toFixed(2)],
        ["Flux de trésorerie net", cashFlow.net_cash_flow.toFixed(2)],
        ["Trésorerie initiale", cashFlow.opening_cash_balance.toFixed(2)],
        ["Trésorerie finale", cashFlow.closing_cash_balance.toFixed(2)]
      ];
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `etat-flux-tresorerie_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout title="État des Flux de Trésorerie" subtitle="Rapport montrant les entrées et sorties de trésorerie">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">État des Flux de Trésorerie</h2>
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
            <p className="text-muted-foreground">Chargement de l'état des flux de trésorerie...</p>
          </div>
        ) : cashFlow ? (
          <div className="space-y-8">
            {/* Cash Flow Statement */}
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-lg">FLUX DE TRÉSORERIE</TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell className="font-medium w-3/4">Activités d'exploitation</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cashFlow.operating_activities >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={cashFlow.operating_activities} />
                      </span>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell className="font-medium w-3/4">Activités d'investissement</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cashFlow.investing_activities >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={cashFlow.investing_activities} />
                      </span>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell className="font-medium w-3/4">Activités de financement</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cashFlow.financing_activities >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={cashFlow.financing_activities} />
                      </span>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell className="text-right">Flux de trésorerie net</TableCell>
                    <TableCell className="text-right">
                      <span className={cashFlow.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={cashFlow.net_cash_flow} />
                      </span>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell className="font-medium w-3/4">Trésorerie au début de la période</TableCell>
                    <TableCell className="text-right font-medium">
                      <CurrencyDisplay amountUSD={cashFlow.opening_cash_balance} />
                    </TableCell>
                  </TableRow>
                  
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell className="text-right">Trésorerie à la fin de la période</TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      <span className={cashFlow.closing_cash_balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <CurrencyDisplay amountUSD={cashFlow.closing_cash_balance} />
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Trésorerie Initiale</p>
                <h3 className="text-lg font-bold">
                  <CurrencyDisplay amountUSD={cashFlow.opening_cash_balance} />
                </h3>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Flux de Trésorerie Net</p>
                <h3 className={`text-lg font-bold ${cashFlow.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={cashFlow.net_cash_flow} />
                </h3>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Trésorerie Finale</p>
                <h3 className={`text-lg font-bold ${cashFlow.closing_cash_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={cashFlow.closing_cash_balance} />
                </h3>
              </div>
            </div>

            {/* Cash Flow Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Operating Activities Analysis */}
              <div className="bg-card rounded-lg border shadow-soft p-4">
                <h3 className="font-semibold mb-2">Activités d'Exploitation</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {cashFlow.operating_activities >= 0 
                    ? "L'entreprise génère des flux de trésorerie positifs à partir de ses activités principales."
                    : "L'entreprise consomme de la trésorerie à partir de ses activités principales."}
                </p>
                <div className={`text-lg font-bold ${cashFlow.operating_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={cashFlow.operating_activities} />
                </div>
              </div>

              {/* Investing Activities Analysis */}
              <div className="bg-card rounded-lg border shadow-soft p-4">
                <h3 className="font-semibold mb-2">Activités d'Investissement</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {cashFlow.investing_activities >= 0 
                    ? "L'entreprise réalise des gains d'investissement ou vend des actifs."
                    : "L'entreprise investit dans des actifs ou des projets."}
                </p>
                <div className={`text-lg font-bold ${cashFlow.investing_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={cashFlow.investing_activities} />
                </div>
              </div>

              {/* Financing Activities Analysis */}
              <div className="bg-card rounded-lg border shadow-soft p-4">
                <h3 className="font-semibold mb-2">Activités de Financement</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {cashFlow.financing_activities >= 0 
                    ? "L'entreprise obtient des financements (emprunts, capital)."
                    : "L'entreprise rembourse des dettes ou distribue des dividendes."}
                </p>
                <div className={`text-lg font-bold ${cashFlow.financing_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amountUSD={cashFlow.financing_activities} />
                </div>
              </div>
            </div>

            {/* Overall Cash Flow Health */}
            <div className={`p-4 rounded-lg border ${cashFlow.net_cash_flow >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${cashFlow.net_cash_flow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>
                  {cashFlow.net_cash_flow >= 0 
                    ? `L'entreprise a généré un flux de trésorerie net positif de ${formatCurrency(cashFlow.net_cash_flow, rate).usd} pendant cette période, ce qui indique une bonne santé financière.` 
                    : `L'entreprise a un flux de trésorerie net négatif de ${formatCurrency(Math.abs(cashFlow.net_cash_flow), rate).usd} pendant cette période. Cela pourrait indiquer un besoin de revoir la gestion de trésorerie.`}
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

export default CashFlowStatement;