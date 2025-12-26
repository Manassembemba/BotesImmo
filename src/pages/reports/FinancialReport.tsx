import { getStatusBadge } from '@/pages/Invoices'; // Import getStatusBadge from Invoices page

const FinancialReport = () => {
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
    pageSize: 1000, // Load all for report generation
  });

  const { data: invoicesResult, isLoading } = useInvoices({ filters, pagination });
  
  const invoices = invoicesResult?.data || [];

  // Calculate aggregates
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
    <MainLayout title="Rapport Financier Complet" subtitle="Vue d'overview des revenus et gestion financière.">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-card shadow-sm">
          <InvoiceFilters
            invoices={invoices}
            onFilterChange={setFilters}
          />
        </div>

        {/* Aggregate Statistics */}
        {role === 'ADMIN' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total net facturé</p>
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

        <div className="flex justify-end gap-2">
           <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
          <Button variant="outline" size="sm">
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
      </div>
    </MainLayout>
  );
};

export default FinancialReport;
