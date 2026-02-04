import { getStatusBadge } from '@/pages/Invoices'; // Import getStatusBadge from Invoices page
import { useAuth } from '@/hooks/useAuth'; // Added import for useAuth
import { useState, useMemo } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { MainLayout } from '@/components/layout/MainLayout';
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Download, Landmark, ReceiptText, AlertTriangle } from 'lucide-react';
import { exportFinancialReportToCsv, exportFinancialReportToPdf } from '@/services/financialReportExportService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CashReport } from '@/components/reports/CashReport';
import { DebtsReport } from '@/components/reports/DebtsReport';
import { Badge } from '@/components/ui/badge';

const FinancialReport = () => {
  const { role } = useAuth();

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateRange: { start: '', end: '' },
    customer: 'all',
  });

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 1000, // Load all for report generation
  });

  const { data: invoicesResult, isLoading } = useInvoices({ filters, pagination });

  const invoices = invoicesResult?.data || [];


  return (
    <MainLayout title="Rapport Financier Complet" subtitle="Vue d'overview des revenus et gestion financière.">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <InvoiceFilters
            invoices={invoices}
            onFilterChange={setFilters}
          />
        </div>


        <Tabs defaultValue="cash" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Caisse Physique
            </TabsTrigger>
            <TabsTrigger value="debts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Dettes (Dépassement)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-6 pt-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportFinancialReportToPdf(invoices, filters)}>
                <Download className="h-4 w-4 mr-2" />
                Exporter PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportFinancialReportToCsv(invoices, filters)}>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
            </div>

            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TYPE</TableHead>
                    <TableHead>N° FACTURE</TableHead>
                    <TableHead>CLIENT</TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>MONTANT NET</TableHead>
                    <TableHead>PAYÉ</TableHead>
                    <TableHead>DÛ</TableHead>
                    <TableHead>STATUT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="h-24 text-center">Chargement...</TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="h-24 text-center">Aucune facture trouvée.</TableCell></TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {invoice.invoice_number.startsWith('INV-EXT-') ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Prolongation</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Réservation</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.tenant_name}</TableCell>
                        <TableCell>{format(new Date(invoice.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell><CurrencyDisplay amountUSD={invoice.net_total || invoice.total} /></TableCell>
                        <TableCell><CurrencyDisplay amountUSD={invoice.amount_paid} /></TableCell>
                        <TableCell><CurrencyDisplay amountUSD={invoice.balance_due || 0} /></TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          {/* Add actions here */}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cash" className="pt-6">
            <CashReport filters={filters} />
          </TabsContent>

          <TabsContent value="debts" className="pt-6">
            <DebtsReport />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default FinancialReport;
