import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Download, Printer, Filter, ChevronDown } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useBookings } from '@/hooks/useBookings';
import { useTenants } from '@/hooks/useTenants';
import { Invoice } from '@/interfaces/Invoice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { downloadInvoicePDF } from '@/services/invoicePdfService';
import { useAuth } from '@/hooks/useAuth';
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters';
import { InvoiceStats } from '@/components/invoices/InvoiceStats';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const getStatusBadge = (status: Invoice['status']) => {
  const config: Record<Invoice['status'], { label: string; className: string }> = {
    DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    ISSUED: { label: 'Émise', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    PAID: { label: 'Payée', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, className } = config[status];
  return (
    <Badge className={`font-medium text-xs px-3 py-1 ${className}`}>
      {label}
    </Badge>
  );
};

const Invoices = () => {
  const { role } = useAuth();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: bookings = [] } = useBookings();
  const { data: tenants = [] } = useTenants();

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateRange: { start: '', end: '' },
    amountRange: { min: null as number | null, max: null as number | null },
    customer: 'all',
    roomNumber: 'all'
  });

  // Associer les données de réservation et de locataire aux factures
  const enhancedInvoices = useMemo(() => {
    return invoices.map(invoice => {
      const booking = bookings.find(b => b.id === invoice.booking_id);
      const tenant = tenants.find(t => t.id === invoice.tenant_id);

      return {
        ...invoice,
        booking,
        tenant
      };
    });
  }, [invoices, bookings, tenants]);

  // Calcul des statistiques
  const stats = useMemo(() => {
    const totalInvoices = enhancedInvoices.length;
    const paidInvoices = enhancedInvoices.filter(inv => inv.status === 'PAID').length;
    const totalAmount = enhancedInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidAmount = enhancedInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = totalAmount - paidAmount;
    const averageInvoiceAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    return {
      totalInvoices,
      paidInvoices,
      totalAmount,
      pendingAmount,
      averageInvoiceAmount
    };
  }, [enhancedInvoices]);

  // Filtrer les factures
  const filteredInvoices = useMemo(() => {
    return enhancedInvoices.filter(invoice => {
      const matchesSearch = (
        invoice.invoice_number.toLowerCase().includes(filters.search.toLowerCase()) ||
        invoice.tenant_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        invoice.tenant?.prenom?.toLowerCase().includes(filters.search.toLowerCase()) ||
        invoice.tenant?.nom?.toLowerCase().includes(filters.search.toLowerCase())
      );

      const matchesStatus = filters.status === 'all' || invoice.status === filters.status;

      const matchesDate = (() => {
        if (!filters.dateRange.start && !filters.dateRange.end) return true;
        const invoiceDate = new Date(invoice.date);
        if (filters.dateRange.start && filters.dateRange.end) {
          return invoiceDate >= new Date(filters.dateRange.start) &&
            invoiceDate <= new Date(filters.dateRange.end);
        }
        if (filters.dateRange.start) return invoiceDate >= new Date(filters.dateRange.start);
        if (filters.dateRange.end) return invoiceDate <= new Date(filters.dateRange.end);
        return true;
      })();

      const matchesAmount = (() => {
        if (filters.amountRange.min !== null && invoice.total < filters.amountRange.min) return false;
        if (filters.amountRange.max !== null && invoice.total > filters.amountRange.max) return false;
        return true;
      })();

      const matchesCustomer = filters.customer === 'all' || invoice.tenant_name === filters.customer;

      const matchesRoom = filters.roomNumber === 'all' || invoice.room_number === filters.roomNumber;

      return matchesSearch && matchesStatus && matchesDate && matchesAmount && matchesCustomer && matchesRoom;
    });
  }, [enhancedInvoices, filters]);

  if (isLoading) {
    return (
      <MainLayout title="FACTURES">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des factures...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="FACTURES">
      <div className="space-y-6">
        {/* Statistiques */}
        <InvoiceStats
          totalInvoices={stats.totalInvoices}
          paidInvoices={stats.paidInvoices}
          totalAmount={stats.totalAmount}
          pendingAmount={stats.pendingAmount}
          averageInvoiceAmount={stats.averageInvoiceAmount}
        />

        {/* Filtres avancés */}
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <InvoiceFilters
            invoices={enhancedInvoices}
            onFilterChange={setFilters}
          />
        </div>

        {/* Actions rapides */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {filteredInvoices.length} facture{filteredInvoices.length !== 1 ? 's' : ''} trouvée{filteredInvoices.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {/* Exporter en PDF */}}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {/* Exporter en CSV */}}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {/* Exporter en Excel */}}>Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(role === 'ADMIN' || role === 'AGENT_RES') && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border">
            <p className="text-lg font-medium text-foreground mb-2">Aucune facture trouvée</p>
            <p className="text-sm text-muted-foreground">
              {invoices.length === 0
                ? 'Aucune facture n\'a été générée'
                : 'Essayez de modifier vos filtres'}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-primary-foreground font-semibold">N° FACTURE</TableHead>
                  <TableHead className="text-primary-foreground font-semibold">CLIENT</TableHead>
                  <TableHead className="text-primary-foreground font-semibold">DATE</TableHead>
                  <TableHead className="text-primary-foreground font-semibold">ÉCHÉANCE</TableHead>
                  <TableHead className="text-primary-foreground font-semibold">MONTANT</TableHead>
                  <TableHead className="text-primary-foreground font-semibold">STATUT</TableHead>
                  <TableHead className="text-primary-foreground font-semibold text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-secondary/50">
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{invoice.tenant_name}</p>
                        <p className="text-xs text-muted-foreground">{invoice.room_number} ({invoice.room_type})</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr }) : '-'}
                    </TableCell>
                    <TableCell>{invoice.total.toFixed(2)} {invoice.currency}</TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="default"
                          className="h-8 w-8"
                          onClick={() => downloadInvoicePDF(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="default"
                          className="h-8 w-8"
                          onClick={() => downloadInvoicePDF(invoice)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Invoices;