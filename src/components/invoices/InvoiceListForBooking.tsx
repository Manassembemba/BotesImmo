import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BadgeDollarSign } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceView } from './InvoiceView';
import { Invoice } from '@/interfaces/Invoice';

interface InvoiceListForBookingProps {
  bookingId: string;
}

export function InvoiceListForBooking({ bookingId }: InvoiceListForBookingProps) {
  const { data: invoices = [], isLoading } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filtrer les factures pour cette réservation spécifique
  const bookingInvoices = invoices.filter(invoice => invoice.booking_id === bookingId);

  const openInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Chargement des factures...
      </div>
    );
  }

  if (bookingInvoices.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Aucune facture générée
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Factures associées:</div>
      <div className="space-y-1">
        {bookingInvoices.map((invoice) => (
          <div key={invoice.id} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {invoice.invoice_number} - {invoice.total.toFixed(2)} {invoice.currency}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openInvoice(invoice)}
              className="h-7 w-7 p-0"
            >
              <BadgeDollarSign className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Facture</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {selectedInvoice && <InvoiceView invoice={selectedInvoice} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}