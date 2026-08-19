import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, Calendar, User } from 'lucide-react';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface InvoiceStatsProps {
  totalInvoices: number;
  paidInvoices: number;
  totalAmount: number;
  pendingAmount: number;
  averageInvoiceAmount: number;
}

export function InvoiceStats({
  totalInvoices,
  paidInvoices,
  totalAmount,
  pendingAmount,
  averageInvoiceAmount
}: InvoiceStatsProps) {
  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  const unpaidInvoices = totalInvoices - paidInvoices;
  const paidPercentage = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-200/50 dark:from-blue-900/20 dark:to-blue-900/30 dark:border-blue-800/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Factures</CardTitle>
          <FileText className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalInvoices}</div>
          <p className="text-xs text-muted-foreground">Toutes factures émises</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-green-200/50 dark:from-green-900/20 dark:to-green-900/30 dark:border-green-800/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Payées</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{paidInvoices}</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {paidPercentage}% payées
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-200/50 dark:from-amber-900/20 dark:to-amber-900/30 dark:border-amber-800/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Impayées</CardTitle>
          <Calendar className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unpaidInvoices}</div>
          <p className="text-xs text-muted-foreground">En attente de paiement</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-purple-200/50 dark:from-purple-900/20 dark:to-purple-900/30 dark:border-purple-800/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Montant</CardTitle>
          <User className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(totalAmount, rate).usd}
          </div>
          <div className="text-xs text-muted-foreground">
            Moyenne: {formatCurrency(averageInvoiceAmount, rate).usd}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}