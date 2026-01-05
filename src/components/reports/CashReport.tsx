import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Banknote, Calendar as CalendarIcon, ArrowUpRight, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { exportCashReportToCsv, exportCashReportToPdf } from '@/services/financialReportExportService';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';

interface CaisseSummary {
    date: string;
    total_usd: number;
    total_cdf: number;
    total_equivalent_usd: number;
    nombre_paiements: number;
    methodes_utilisees: string[];
}

interface CashReportProps {
    filters?: {
        dateRange: { start: string; end: string };
    };
}

export function CashReport({ filters }: CashReportProps) {
    const { data: exchangeRate } = useExchangeRate();
    const rate = exchangeRate?.usd_to_cdf || 2800;

    const { data: cashStatus, isLoading } = useQuery({
        queryKey: ['cash-status', filters?.dateRange],
        queryFn: async () => {
            let query = supabase
                .from('caisse_daily_summary')
                .select('*');

            if (filters?.dateRange.start) {
                query = query.gte('date', filters.dateRange.start);
            }
            if (filters?.dateRange.end) {
                query = query.lte('date', filters.dateRange.end);
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;
            return data as CaisseSummary[];
        }
    });

    const totals = useMemo(() => {
        if (!cashStatus) return { usd: 0, cdf: 0, total: 0 };
        return cashStatus.reduce((acc, curr) => ({
            usd: acc.usd + curr.total_usd,
            cdf: acc.cdf + curr.total_cdf,
            total: acc.total + curr.total_equivalent_usd
        }), { usd: 0, cdf: 0, total: 0 });
    }, [cashStatus]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Résumé Global */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background border-green-100 dark:border-green-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Total USD (Physique)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {totals.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} $
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            Somme des dollars physiques encaissés
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Total CDF (Physique)</CardTitle>
                        <Banknote className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                            {totals.cdf.toLocaleString('fr-FR')} FC
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Somme des francs congolais encaissés
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-background border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Équivalent USD</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} $
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Valeur totale combinée en USD
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Détail Journalier */}
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCashReportToPdf(cashStatus || [], filters, totals)}>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportCashReportToCsv(cashStatus || [], filters)}>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                            Historique de Caisse Journalier
                        </CardTitle>
                        <Badge variant="outline">{cashStatus?.length || 0} jours enregistrés</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-muted-foreground text-left">
                                    <th className="py-3 px-4 font-medium">Date</th>
                                    <th className="py-3 px-4 font-medium text-right">USD Physique</th>
                                    <th className="py-3 px-4 font-medium text-right">CDF Physique</th>
                                    <th className="py-3 px-4 font-medium text-right">Total (USD Equiv.)</th>
                                    <th className="py-3 px-4 font-medium hidden md:table-cell">Méthodes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashStatus?.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                            Aucune transaction enregistrée
                                        </td>
                                    </tr>
                                ) : (
                                    cashStatus?.map((day) => (
                                        <tr key={day.date} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-medium">
                                                    {format(new Date(day.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                                                </div>
                                                <div className="text-xs text-muted-foreground md:hidden">
                                                    {day.nombre_paiements} paiement(s)
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right text-green-600 font-semibold">
                                                {day.total_usd.toFixed(2)} $
                                            </td>
                                            <td className="py-3 px-4 text-right text-blue-600 font-semibold">
                                                {day.total_cdf.toLocaleString('fr-FR')} FC
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold">
                                                {day.total_equivalent_usd.toFixed(2)} $
                                            </td>
                                            <td className="py-3 px-4 hidden md:table-cell">
                                                <div className="flex flex-wrap gap-1">
                                                    {day.methodes_utilisees.map(m => (
                                                        <Badge key={m} variant="secondary" className="text-[10px] uppercase">
                                                            {m}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-xs text-muted-foreground text-center">
                💡 Ce rapport utilise les montants enregistrés avec le taux en vigueur lors de chaque paiement.
            </div>
        </div>
    );
}

// Helper hook used inside the component
