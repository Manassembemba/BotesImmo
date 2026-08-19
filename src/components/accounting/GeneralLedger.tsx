import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { Account, GeneralLedgerEntry } from '@/interfaces/Accounting';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface GeneralLedgerFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const GeneralLedger = () => {
  const [filters, setFilters] = useState<GeneralLedgerFilter>({
    dateRange: {
      start: format(new Date(), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch general ledger entries
  const { data: ledgerEntries = [], isLoading } = useQuery({
    queryKey: ['general-ledger', filters],
    queryFn: async () => {
      let query = supabase
        .from('general_ledger')
        .select(`
          *,
          accounts (code, name)
        `)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (filters.accountIds && filters.accountIds.length > 0) {
        query = query.in('account_id', filters.accountIds);
      }

      if (filters.search) {
        const search = `%${filters.search.toLowerCase()}%`;
        query = query.or(`description.ilike.${search},accounts.name.ilike.${search},accounts.code.ilike.${search}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate running balance
      let runningBalance = 0;
      return (data || []).map((entry: any) => {
        runningBalance += (entry.debit || 0) - (entry.credit || 0);
        return {
          id: entry.id,
          account_id: entry.account_id,
          account_code: entry.accounts?.code || entry.account_code,
          account_name: entry.accounts?.name || entry.account_name,
          journal_entry_id: entry.journal_entry_id,
          journal_entry_number: entry.journal_entry_number,
          date: entry.date,
          description: entry.description,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          balance: entry.balance || 0,
          running_balance: runningBalance,
          currency: entry.currency || 'USD',
        };
      });
    },
  });

  // Calculate totals
  const totals = useMemo(() => {
    return ledgerEntries.reduce((acc, entry) => {
      acc.totalDebit += entry.debit;
      acc.totalCredit += entry.credit;
      return acc;
    }, { totalDebit: 0, totalCredit: 0 });
  }, [ledgerEntries]);

  // Calculate account balances
  const accountBalances = useMemo(() => {
    const balances: Record<string, { accountCode: string; accountName: string; balance: number; currency: string }> = {};

    ledgerEntries.forEach(entry => {
      if (!balances[entry.account_id]) {
        balances[entry.account_id] = {
          accountCode: entry.account_code,
          accountName: entry.account_name,
          balance: 0,
          currency: entry.currency
        };
      }
      balances[entry.account_id].balance += (entry.debit || 0) - (entry.credit || 0);
    });

    return Object.values(balances);
  }, [ledgerEntries]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const headers = [
        "Date", "Numéro Pièce", "Compte", "Libellé", "Débit", "Crédit", "Solde"
      ];

      const rows = ledgerEntries.map(entry => [
        format(new Date(entry.date), 'dd/MM/yyyy'),
        entry.journal_entry_number,
        `${entry.account_code} - ${entry.account_name}`,
        entry.description,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.running_balance.toFixed(2)
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `grand-livre_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MainLayout title="Grand Livre" subtitle="Vue détaillée et analytique de vos transactions">
      <div className="space-y-8 animate-fade-in">
        {/* Filtres section */}
        <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-6 shadow-soft">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        {/* KPI Cards Section - Premium Style */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-medium bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Crédit (Entrées)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                <CurrencyDisplay amountUSD={totals.totalCredit} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total des fonds entrants sur la période</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-medium bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Débit (Sorties)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                <CurrencyDisplay amountUSD={totals.totalDebit} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total des charges ou sorties de fonds</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-medium bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Solde de Période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (totals.totalCredit - totals.totalDebit) >= 0 ? "text-blue-600" : "text-rose-600"
              )}>
                <CurrencyDisplay amountUSD={totals.totalCredit - totals.totalDebit} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Différence nette entre entrées et sorties</p>
            </CardContent>
          </Card>
        </div>

        {/* Progression Chart - Intelligent Analysis */}
        {!isLoading && ledgerEntries.length > 0 && (
          <Card className="border-none shadow-medium overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-secondary/20">
              <div>
                <CardTitle className="text-lg font-bold">Flux de Trésorerie Progressif</CardTitle>
                <p className="text-sm text-muted-foreground">Évolution du solde net au fil des transactions</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleExport('pdf')}><Printer className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleExport('csv')}><Download className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ledgerEntries.map(e => ({
                    date: format(new Date(e.date), 'dd/MM HH:mm'),
                    balance: e.running_balance
                  }))}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(val: number) => [`$${val.toFixed(2)}`, 'Solde']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Ledger Table */}
        <div className="bg-card rounded-xl border shadow-medium overflow-hidden">
          <div className="p-4 bg-secondary/10 flex justify-between items-center border-b">
            <h3 className="font-bold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Journal du Grand Livre
            </h3>
            <Badge variant="secondary" className="font-mono">{ledgerEntries.length} Écritures</Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/5">
                <TableRow>
                  <TableHead className="w-[100px] font-bold">DATE</TableHead>
                  <TableHead className="w-[120px] font-bold">N° PIÈCE</TableHead>
                  <TableHead className="font-bold">COMPTE & LIBELLÉ</TableHead>
                  <TableHead className="text-right font-bold">ENTRÉE</TableHead>
                  <TableHead className="text-right font-bold">SORTIE</TableHead>
                  <TableHead className="text-right font-bold">CUMUL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : ledgerEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Aucune transaction trouvée pour cette période.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="text-xs font-medium">
                        {format(new Date(entry.date), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono bg-background">
                          {entry.journal_entry_number}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-primary">{entry.account_code} - {entry.account_name}</span>
                          <span className="text-sm text-foreground/80 line-clamp-1">{entry.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.credit > 0 ? (
                          <span className="text-emerald-600 font-bold">+{entry.credit.toFixed(2)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.debit > 0 ? (
                          <span className="text-rose-600 font-bold">-{entry.debit.toFixed(2)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        <span className={cn((entry.running_balance) >= 0 ? "text-blue-600" : "text-rose-600")}>
                          {entry.running_balance.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default GeneralLedger;