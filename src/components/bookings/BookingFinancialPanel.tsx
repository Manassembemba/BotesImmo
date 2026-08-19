import { useBookingFinancialSummary } from '@/hooks/useBookingFinancialSummary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeDollarSign, Receipt, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Skeleton } from '@/components/ui/skeleton';

interface BookingFinancialPanelProps {
    bookingId: string;
}

export function BookingFinancialPanel({ bookingId }: BookingFinancialPanelProps) {
    const { data: summary, isLoading, error } = useBookingFinancialSummary(bookingId);
    const { data: exchangeRateData } = useExchangeRate();
    const rate = exchangeRateData?.usd_to_cdf || 2800;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Erreur lors du chargement du résumé financier.</p>
            </div>
        );
    }

    const isFullyPaid = Number(summary.balance_due) <= 0.01;
    const hasInvoices = summary.invoice_count > 0;

    return (
        <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Facturé */}
                <Card className="border-none bg-primary/5 shadow-none overflow-hidden relative group transition-all hover:bg-primary/10">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Total Facturé</p>
                                <p className="text-2xl font-bold text-foreground">
                                    ${Number(summary.total_invoiced).toLocaleString('fr-FR')}
                                </p>
                            </div>
                            <div className="p-2 bg-primary/20 rounded-lg">
                                <Receipt className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                            {summary.invoice_count} facture(s) générée(s)
                        </p>
                    </CardContent>
                </Card>

                {/* Déjà Payé */}
                <Card className="border-none bg-green-500/5 shadow-none overflow-hidden relative group transition-all hover:bg-green-500/10">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Déjà Payé</p>
                                <p className="text-2xl font-bold text-foreground">
                                    ${Number(summary.total_paid).toLocaleString('fr-FR')}
                                </p>
                            </div>
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <CreditCard className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                            {summary.payment_count} encaissement(s)
                        </p>
                    </CardContent>
                </Card>

                {/* Solde Restant */}
                <Card className={`border-none ${isFullyPaid ? 'bg-blue-500/5' : 'bg-orange-500/5'} shadow-none overflow-hidden relative group transition-all hover:${isFullyPaid ? 'bg-blue-500/10' : 'bg-orange-500/10'}`}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`text-xs font-semibold ${isFullyPaid ? 'text-blue-600' : 'text-orange-600'} uppercase tracking-wider mb-1`}>Solde Restant</p>
                                <p className={`text-2xl font-bold ${isFullyPaid ? 'text-blue-600' : 'text-orange-600'}`}>
                                    ${Number(summary.balance_due).toLocaleString('fr-FR')}
                                </p>
                            </div>
                            <div className={`p-2 ${isFullyPaid ? 'bg-blue-500/20' : 'bg-orange-500/20'} rounded-lg`}>
                                {isFullyPaid ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : <BadgeDollarSign className="h-5 w-5 text-orange-600" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                            <span className="text-[10px] text-muted-foreground">~ {Math.round(Number(summary.balance_due) * rate).toLocaleString('fr-FR')} FC</span>
                            {isFullyPaid && <Badge variant="outline" className="text-[10px] h-4 bg-green-100 text-green-700 border-green-200 ml-auto">Soldé</Badge>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {!hasInvoices && (
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed text-center">
                    Aucune facture active pour le moment.
                </div>
            )}
        </div>
    );
}
