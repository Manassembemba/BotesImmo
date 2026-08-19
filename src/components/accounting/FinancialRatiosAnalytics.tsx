import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter, TrendingUp, TrendingDown, DollarSign, Scale, Calculator } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingFilters } from './AccountingFilters';
import { FinancialRatio } from '@/interfaces/Accounting';
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

interface FinancialRatiosFilter {
  dateRange: { start: string; end: string };
  accountIds?: string[];
  search?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

const FinancialRatiosAnalytics = () => {
  const [filters, setFilters] = useState<FinancialRatiosFilter>({
    dateRange: { 
      start: format(new Date(), 'yyyy-MM-dd'), 
      end: format(new Date(), 'yyyy-MM-dd') 
    },
    period: 'today'
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // Fetch financial ratios
  const { data: ratios = [], isLoading } = useQuery({
    queryKey: ['financial-ratios', filters],
    queryFn: async () => {
      // This would typically be calculated from the general ledger
      // For now, we'll simulate the data based on existing transactions
      
      // Get balance sheet data for ratio calculations
      const assetQuery = supabase
        .from('general_ledger')
        .select(`
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.1%,accounts.code.ilike.2%') // Asset accounts
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end);

      const liabilityQuery = supabase
        .from('general_ledger')
        .select(`
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.2%,accounts.code.ilike.3%') // Liability accounts
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end);

      const equityQuery = supabase
        .from('general_ledger')
        .select(`
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.3%') // Equity accounts
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end);

      // Get P&L data for ratio calculations
      const revenueQuery = supabase
        .from('general_ledger')
        .select(`
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.4%,accounts.code.ilike.5%') // Revenue accounts
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end);

      const expenseQuery = supabase
        .from('general_ledger')
        .select(`
          sum(debit) as total_debits,
          sum(credit) as total_credits
        `)
        .or('accounts.code.ilike.6%,accounts.code.ilike.7%') // Expense accounts
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end);

      const [assetResult, liabilityResult, equityResult, revenueResult, expenseResult] = await Promise.all([
        assetQuery,
        liabilityQuery,
        equityQuery,
        revenueQuery,
        expenseQuery
      ]);

      if (assetResult.error) throw assetResult.error;
      if (liabilityResult.error) throw liabilityResult.error;
      if (equityResult.error) throw equityResult.error;
      if (revenueResult.error) throw revenueResult.error;
      if (expenseResult.error) throw expenseResult.error;

      // Calculate values
      const totalAssets = parseFloat(assetResult.data?.[0]?.total_debits || '0') - 
                         parseFloat(assetResult.data?.[0]?.total_credits || '0');
      const totalLiabilities = parseFloat(liabilityResult.data?.[0]?.total_credits || '0') - 
                              parseFloat(liabilityResult.data?.[0]?.total_debits || '0');
      const totalEquity = parseFloat(equityResult.data?.[0]?.total_credits || '0') - 
                         parseFloat(equityResult.data?.[0]?.total_debits || '0');
      const totalRevenue = parseFloat(revenueResult.data?.[0]?.total_credits || '0') - 
                          parseFloat(revenueResult.data?.[0]?.total_debits || '0');
      const totalExpenses = parseFloat(expenseResult.data?.[0]?.total_debits || '0') - 
                           parseFloat(expenseResult.data?.[0]?.total_credits || '0');
      const netIncome = totalRevenue - totalExpenses;

      // Calculate ratios
      const ratios: FinancialRatio[] = [
        {
          name: "Rapport d'endettement",
          value: totalAssets > 0 ? totalLiabilities / totalAssets : 0,
          category: 'solvency',
          description: "Mesure le pourcentage d'actifs financés par des dettes"
        },
        {
          name: "Rapport de liquidité générale",
          value: totalLiabilities > 0 ? totalAssets / totalLiabilities : 0,
          category: 'liquidity',
          description: "Mesure la capacité à rembourser les dettes avec les actifs"
        },
        {
          name: "Rentabilité sur le capital",
          value: totalEquity > 0 ? netIncome / totalEquity : 0,
          category: 'profitability',
          description: "Mesure le rendement généré sur le capital investi"
        },
        {
          name: "Marge nette",
          value: totalRevenue > 0 ? netIncome / totalRevenue : 0,
          category: 'profitability',
          description: "Mesure le pourcentage de chaque dollar de revenu qui devient profit"
        },
        {
          name: "Rotation des actifs",
          value: totalAssets > 0 ? totalRevenue / totalAssets : 0,
          category: 'efficiency',
          description: "Mesure l'efficacité de l'utilisation des actifs pour générer des revenus"
        },
        {
          name: "Ratio dette/capitaux propres",
          value: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
          category: 'solvency',
          description: "Mesure le niveau d'endettement par rapport aux capitaux propres"
        }
      ];

      return ratios;
    },
  });

  // Group ratios by category
  const groupedRatios = useMemo(() => {
    return ratios.reduce((acc, ratio) => {
      if (!acc[ratio.category]) {
        acc[ratio.category] = [];
      }
      acc[ratio.category].push(ratio);
      return acc;
    }, {} as Record<string, FinancialRatio[]>);
  }, [ratios]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const headers = [
        "Nom", "Valeur", "Catégorie", "Description"
      ];
      
      const rows = ratios.map(ratio => [
        ratio.name,
        ratio.value.toFixed(4),
        ratio.category,
        ratio.description
      ]);
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `ratios-financiers_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Get ratio icons
  const getRatioIcon = (category: string) => {
    switch (category) {
      case 'liquidity':
        return <DollarSign className="h-4 w-4" />;
      case 'profitability':
        return <TrendingUp className="h-4 w-4" />;
      case 'efficiency':
        return <Scale className="h-4 w-4" />;
      case 'solvency':
        return <Calculator className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  // Get ratio color
  const getRatioColor = (value: number, category: string) => {
    switch (category) {
      case 'liquidity':
        return value >= 1 ? 'text-green-600' : 'text-red-600';
      case 'profitability':
        return value >= 0 ? 'text-green-600' : 'text-red-600';
      case 'efficiency':
        return value > 0 ? 'text-green-600' : 'text-red-600';
      case 'solvency':
        return value <= 1 ? 'text-green-600' : 'text-red-600';
      default:
        return 'text-foreground';
    }
  };

  return (
    <MainLayout title="Ratios et Analyse Financière" subtitle="Analyse détaillée des ratios financiers clés">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <AccountingFilters
            filters={filters}
            onFilterChange={setFilters as any}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Ratios Financiers</h2>
            <Badge variant="outline">{ratios.length} ratios</Badge>
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

        {/* Ratio Categories Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(groupedRatios).map(([category, categoryRatios]) => (
            <Card key={category} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize flex items-center gap-2">
                  {getRatioIcon(category)}
                  {category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {categoryRatios.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  ratios dans cette catégorie
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Ratios Analysis */}
        {Object.entries(groupedRatios).map(([category, categoryRatios]) => (
          <div key={category} className="bg-card rounded-lg border shadow-soft overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold capitalize flex items-center gap-2">
                {getRatioIcon(category)}
                {category} ({categoryRatios.length} ratios)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Interprétation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryRatios.map((ratio, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{ratio.name}</TableCell>
                    <TableCell className={`text-right font-medium ${getRatioColor(ratio.value, ratio.category)}`}>
                      {ratio.value >= 1 ? (ratio.value * 100).toFixed(2) + '%' : ratio.value.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ratio.description}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        let interpretation = '';
                        switch (ratio.category) {
                          case 'liquidity':
                            interpretation = ratio.value >= 1 
                              ? 'Bonne capacité de couvrir les dettes à court terme' 
                              : 'Capacité limitée à couvrir les dettes à court terme';
                            break;
                          case 'profitability':
                            interpretation = ratio.value >= 0 
                              ? 'Rentabilité positive' 
                              : 'Rentabilité négative';
                            break;
                          case 'efficiency':
                            interpretation = ratio.value > 0 
                              ? 'Utilisation efficace des ressources' 
                              : 'Utilisation inefficace des ressources';
                            break;
                          case 'solvency':
                            interpretation = ratio.value <= 1 
                              ? 'Niveau d\'endettement raisonnable' 
                              : 'Niveau d\'endettement élevé';
                            break;
                          default:
                            interpretation = 'Valeur normale';
                        }
                        return (
                          <span className={`text-sm ${ratio.value >= (ratio.category === 'liquidity' || ratio.category === 'profitability' || ratio.category === 'efficiency' ? 0.5 : 0.5) ? 'text-green-600' : 'text-red-600'}`}>
                            {interpretation}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}

        {/* Financial Health Summary */}
        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Synthèse de la Santé Financière</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="font-medium">Points Forts</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                {ratios.some(r => r.category === 'liquidity' && r.value >= 1) && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Bonne liquidité - capacité à couvrir les obligations à court terme</span>
                  </li>
                )}
                {ratios.some(r => r.category === 'profitability' && r.value > 0) && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Profitabilité positive - l'entreprise génère des bénéfices</span>
                  </li>
                )}
                {ratios.some(r => r.category === 'solvency' && r.value <= 1) && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Niveau d'endettement raisonnable</span>
                  </li>
                )}
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Domaines d'Amélioration</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                {ratios.some(r => r.category === 'liquidity' && r.value < 1) && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">⚠</span>
                    <span>Améliorer la liquidité pour mieux couvrir les obligations à court terme</span>
                  </li>
                )}
                {ratios.some(r => r.category === 'profitability' && r.value <= 0) && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">⚠</span>
                    <span>Travailler à améliorer la rentabilité</span>
                  </li>
                )}
                {ratios.some(r => r.category === 'solvency' && r.value > 1) && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">⚠</span>
                    <span>Réduire le niveau d'endettement</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recommandations</h3>
          </div>
          <div className="p-4">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-medium">•</span>
                <span>Surveiller régulièrement les ratios pour détecter les tendances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-medium">•</span>
                <span>Comparer les ratios avec les normes du secteur pour évaluer la performance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-medium">•</span>
                <span>Utiliser les ratios pour prendre des décisions éclairées sur les investissements et le financement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-medium">•</span>
                <span>Établir des objectifs de ratio pour suivre les progrès</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FinancialRatiosAnalytics;