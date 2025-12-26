import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { Invoice } from '@/interfaces/Invoice';
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
import { downloadInvoicePDF } from '@/services/invoicePdfService';
import { useAuth } from '@/hooks/useAuth';
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters';
import { InvoiceStats } from '@/components/invoices/InvoiceStats';
import { CurrencyDisplay } from '@/components/CurrencyDisplay'; // Added import for CurrencyDisplay
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const getStatusBadge = (status: Invoice['status']) => {
  const config: Record<Invoice['status'], { label: string; className: string }> = {
    DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
    ISSUED: { label: 'Émise', className: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Payée', className: 'bg-green-100 text-green-800' },
    CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-800' },
    PARTIALLY_PAID: { label: 'Partiellement payée', className: 'bg-orange-100 text-orange-800' }, // Added PARTIALLY_PAID
  };
  const { label, className } = config[status] || {};
  return (
    <Badge className={`font-medium text-xs px-3 py-1 ${className}`}>
      {label}
    </Badge>
  );
};

const Invoices = () => {
  const { role } = useAuth();
  
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateRange: { start: '', end: '' },
    amountRange: { min: null as number | null, max: null as number | null },
    customer: 'all',
    roomNumber: 'all'
  });

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 15,
  });

  const { data: invoicesResult, isLoading } = useInvoices({ filters, pagination });
  
  const invoices = invoicesResult?.data || [];
  const pageCount = invoicesResult?.count ? Math.ceil(invoicesResult.count / pagination.pageSize) : 0;

  // Calculate aggregates for ADMIN view
  const { totalBilled, totalPaid, totalBalanceDue } = useMemo(() => {
    const billed = invoices.reduce((sum, inv) => sum + (inv.net_total || inv.total), 0);
    const paid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    return {
      totalBilled: billed,
      totalPaid: paid,
      totalBalanceDue: billed - paid,
    };
  }, [invoices]);
  
  return (
    <MainLayout title="FACTURES">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <InvoiceFilters
            invoices={invoices}
            onFilterChange={setFilters}
          />
        </div>

        {/* Aggregate Statistics - Only for Admin */}
        {role === 'ADMIN' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total facturé (net)</p>
              <h3 className="text-lg font-bold"><CurrencyDisplay amountUSD={totalBilled} /></h3>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total payé</p>
              <h3 className="text-lg font-bold text-green-600"><CurrencyDisplay amountUSD={totalPaid} /></h3>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Solde restant</p>
              <h3 className="text-lg font-bold text-red-600"><CurrencyDisplay amountUSD={totalBalanceDue} /></h3>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {invoicesResult?.count ?? 0} facture(s) trouvée(s).
          </p>
        </div>

        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° FACTURE</TableHead>
                <TableHead>CLIENT</TableHead>
                <TableHead>DATE</TableHead>
                <TableHead>MONTANT</TableHead>
                <TableHead>STATUT</TableHead>
                <TableHead className="text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Chargement...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Aucune facture trouvée.</TableCell></TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.tenant_name}</TableCell>
                    <TableCell>{format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell>{invoice.total.toFixed(2)} {invoice.currency}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadInvoicePDF(invoice)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))}
            disabled={pagination.pageIndex === 0}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.pageIndex + 1} sur {pageCount || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
            disabled={pagination.pageIndex >= pageCount - 1}
          >
            Suivant
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Invoices;