import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BadgeDollarSign, FileText, XCircle } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceView } from './InvoiceView';
import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

interface InvoiceListForBookingProps {
  bookingId: string;
}

// Sub-component for the dialog showing the list of invoices
function InvoiceSummaryDialog({ bookingId, invoices, isOpen, onClose }: {
  bookingId: string;
  invoices: Invoice[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);

  const openInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceViewOpen(true);
  };

  const closeInvoiceView = () => {
    setSelectedInvoice(null);
    setIsInvoiceViewOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Factures de la réservation</DialogTitle>
          <DialogDescription>
            Liste de toutes les factures associées à cette réservation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded-md p-3 hover:bg-muted/50 transition-colors">
              <div className="flex-1 text-sm">
                <p className="font-medium">{invoice.invoice_number}</p>
                <p className="text-muted-foreground text-xs">
                  {format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })} - {invoice.net_total?.toFixed(2) || invoice.total.toFixed(2)} {invoice.currency}
                </p>
                <p className="text-xs text-muted-foreground">Statut: {invoice.status}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInvoice(invoice)}
                className="mt-2 sm:mt-0"
              >
                <FileText className="h-4 w-4 mr-2" />
                Voir détails
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>

        {/* Dialog for individual invoice view */}
        <Dialog open={isInvoiceViewOpen} onOpenChange={closeInvoiceView}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Détails de la Facture</DialogTitle>
              <DialogDescription className="sr-only">
                Détails de la facture sélectionnée.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6">
              {selectedInvoice && <InvoiceView invoice={selectedInvoice} />}
            </div>
            <DialogFooter className="p-6 pt-0">
              <Button variant="outline" onClick={closeInvoiceView}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}


export function InvoiceListForBooking({ bookingId }: InvoiceListForBookingProps) {
  const { data: result, isLoading } = useInvoices({
    filters: { bookingId },
    pagination: { pageIndex: 0, pageSize: 100 } // Charger toutes les factures pour cette réservation
  });
  const bookingInvoices = result?.data || [];

  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  if (bookingInvoices.length === 0) {
    return <div className="text-sm text-muted-foreground">Aucune facture</div>;
  }

  // Calculate total amount for all invoices for display
  const totalAmountAllInvoices = bookingInvoices.reduce((sum, inv) => sum + (inv.net_total || inv.total), 0);
  const totalPaidAllInvoices = bookingInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const totalBalanceDue = totalAmountAllInvoices - totalPaidAllInvoices;

  return (
    <div className="space-y-1">
      <div className="text-sm">
        <p className="font-medium">{bookingInvoices[0].invoice_number}...</p>
        <p className="text-muted-foreground text-xs">Total: {totalAmountAllInvoices.toFixed(2)} USD</p>
        {totalBalanceDue > 0 && (
          <p className="text-red-500 text-xs">Reste: {totalBalanceDue.toFixed(2)} USD</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsSummaryDialogOpen(true)}
        className="h-7 px-2 text-xs"
      >
        <BadgeDollarSign className="h-3 w-3 mr-1" />
        Voir {bookingInvoices.length} facture(s)
      </Button>

      <InvoiceSummaryDialog
        bookingId={bookingId}
        invoices={bookingInvoices}
        isOpen={isSummaryDialogOpen}
        onClose={() => setIsSummaryDialogOpen(false)}
      />
    </div>
  );
}
