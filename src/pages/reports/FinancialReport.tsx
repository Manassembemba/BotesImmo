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
import { Download, Landmark, ReceiptText } from 'lucide-react';
import { exportFinancialReportToCsv, exportFinancialReportToPdf } from '@/services/financialReportExportService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CashReport } from '@/components/reports/CashReport';

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
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Caisse Physique
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
                    <TableHead>N° FACTURE</TableHead>
                    <TableHead>CLIENT</TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>MONTANT NET</TableHead>
                    <TableHead>PAYÉ</TableHead>
                    <TableHead>DÛ</TableHead>
                    <TableHead>STATUT</TableHead>
                    <TableHead className="text-right">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center">Chargement...</TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center">Aucune facture trouvée.</TableCell></TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
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
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default FinancialReport;
