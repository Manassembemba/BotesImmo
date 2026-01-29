import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Share2, FileDown } from 'lucide-react';
import { downloadInvoicePDF, shareInvoiceAsPDF } from '@/services/invoicePdfService';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { usePaymentsByInvoice } from '@/hooks/usePayments';
import { useMemo } from 'react';
import { startOfToday, startOfDay, isAfter, differenceInCalendarDays } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

interface InvoiceViewProps {
  invoice: Invoice;
}

export function InvoiceView({ invoice }: InvoiceViewProps) {
  const invoiceDate = format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr });
  const dueDate = invoice.due_date ? format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: fr }) : null;
  const { data: exchangeRateData } = useExchangeRate();
  const { data: payments = [] } = usePaymentsByInvoice(invoice.id);

  // Calcul du breakdown physique
  const totalUSD = payments.reduce((sum, p) => sum + (p.montant_usd || 0), 0);
  const totalCDF = payments.reduce((sum, p) => sum + (p.montant_cdf || 0), 0);
  const totalPaidAmount = payments.reduce((sum, p) => sum + (p.montant || 0), 0);

  // Déterminer le titre en fonction du contenu
  const getInvoiceTitle = () => {
    const hasExtension = invoice.items.some(item =>
      item.description.toLowerCase().includes('prolongation') ||
      item.description.toLowerCase().includes('extension')
    );
    return hasExtension ? "FACTURE DE PROLONGATION" : "FACTURE DE SÉJOUR";
  };

  // Détermine le badge pour le statut
  const statusBadge = () => {
    switch (invoice.status) {
      case 'PAID':
        return <Badge className="bg-green-500">Payée</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge className="bg-orange-500">Partiellement payée</Badge>;
      case 'ISSUED':
        return <Badge className="bg-yellow-500">Émise</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-500">Annulée</Badge>;
      default:
        return <Badge className="bg-blue-500">Brouillon</Badge>;
    }
  };

  // Detect if there's a late stay debt currently (virtual)
  const lateStayInfo = useMemo(() => {
    if (!invoice.booking_dates?.end) return null;
    const today = startOfToday();
    const plannedEnd = startOfDay(new Date(invoice.booking_dates.end));

    if (isAfter(today, plannedEnd) && (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'DRAFT')) {
      const lateNights = differenceInCalendarDays(today, plannedEnd);
      // Heuristic for daily rate: find "Location" or use invoice net/nights
      const locationItem = invoice.items.find(item => item.description.toLowerCase().includes('location'));
      const dailyRate = locationItem ? locationItem.unit_price : 0;

      if (dailyRate > 0) {
        return { lateNights, lateDebt: lateNights * dailyRate, dailyRate };
      }
    }
    return null;
  }, [invoice]);

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm max-w-4xl mx-auto">
      {/* En-tête de la facture */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">{getInvoiceTitle()}</h1>
          <p className="text-gray-600">#{invoice.invoice_number}</p>
          <div className="mt-4 flex gap-2">
            {statusBadge()}
            <Badge variant="outline">{invoice.currency}</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold">Botes Immo</p>
          <p className="text-sm text-gray-600">Gestion des locations</p>
          <p className="text-sm text-gray-600">Kinshasa, RDC</p>
        </div>
      </div>

      {/* Détails expéditeur et destinataire */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold mb-2">Émise à:</h3>
          <p className="font-medium">{invoice.tenant_name}</p>
          {invoice.tenant_email && <p className="text-sm">{invoice.tenant_email}</p>}
          {invoice.tenant_phone && <p className="text-sm">{invoice.tenant_phone}</p>}
        </div>
        <div className="text-right">
          <h3 className="font-semibold mb-2">Date d'émission:</h3>
          <p>{invoiceDate}</p>
          {dueDate && (
            <>
              <h3 className="font-semibold mt-2">Date d'échéance:</h3>
              <p>{dueDate}</p>
            </>
          )}
        </div>
      </div>

      {/* Détails de la réservation */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Détails de la réservation:</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Arrivée:</p>
            <p>{format(new Date(invoice.booking_dates!.start), 'dd/MM/yyyy', { locale: fr })} à 12:00</p>
          </div>
          <div>
            <p className="text-gray-600">Départ:</p>
            <p>{format(new Date(invoice.booking_dates!.end), 'dd/MM/yyyy', { locale: fr })} à 11:00</p>
          </div>
          <div>
            <p className="text-gray-600">Chambre:</p>
            <p>{invoice.room_number} ({invoice.room_type})</p>
          </div>
        </div>
      </div>

      {/* Tableau des articles */}
      <div className="mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Quantité</th>
              <th className="text-right py-2">Prix unitaire</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{item.unit_price.toFixed(2)} {invoice.currency}</td>
                <td className="py-2 text-right">{item.total.toFixed(2)} {invoice.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résumé des totaux */}
      <div className="ml-auto w-64">
        <div className="flex justify-between mb-1">
          <span>Total facturé:</span>
          <span>{invoice.total.toFixed(2)} {invoice.currency}</span>
        </div>
        {invoice.discount_amount && (
          <div className="flex justify-between mb-1">
            <span>Réduction:</span>
            <span>-{invoice.discount_amount.toFixed(2)} {invoice.currency}</span>
          </div>
        )}
        {invoice.tax_amount && invoice.tax_rate && (
          <div className="flex justify-between mb-1">
            <span>Taxe ({invoice.tax_rate}%):</span>
            <span>{invoice.tax_amount.toFixed(2)} {invoice.currency}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
          <span>Montant payé:</span>
          <div className="text-right">
            <span>{invoice.amount_paid.toFixed(2)} {invoice.currency}</span>
            <div className="text-xs text-blue-600 font-medium mt-1">
              Détail: {totalUSD.toFixed(2)}$ + {totalCDF.toLocaleString()} FC
            </div>
          </div>
        </div>
        {invoice.balance_due > 0 && (
          <div className="flex justify-between font-bold text-lg text-red-600 border-t pt-2 mt-2">
            <span>Reste à payer {lateStayInfo ? '(Base)' : ''}:</span>
            <div className="text-right">
              <span>{invoice.balance_due.toFixed(2)} {invoice.currency}</span>
              <div className="text-xs font-normal">
                ~ {(invoice.balance_due * (exchangeRateData?.usd_to_cdf || 2800)).toLocaleString('fr-FR')} FC
              </div>
            </div>
          </div>
        )}

        {lateStayInfo && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-pulse-soft">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>DÉPASSEMENT DE SÉJOUR</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-600 font-medium">{lateStayInfo.lateNights} nuits supp. :</span>
              <span className="font-bold">+{lateStayInfo.lateDebt.toFixed(2)} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-base font-black text-red-700 border-t border-red-200 pt-2 mt-2">
              <span>TOTAL RÉACTUALISÉ:</span>
              <span>{((invoice.balance_due || 0) + lateStayInfo.lateDebt).toFixed(2)} {invoice.currency}</span>
            </div>
            <p className="text-[10px] text-red-500 italic mt-1 text-right">
              Montant estimé au {format(new Date(), 'dd/mm/yyyy')}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-8">
          <h3 className="font-semibold mb-2">Notes:</h3>
          <p className="text-sm text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* Boutons d'impression et téléchargement */}
      <div className="mt-8 flex justify-end gap-2">
        <Button variant="outline" onClick={() => downloadInvoicePDF(invoice)}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
        <Button onClick={() => shareInvoiceAsPDF(invoice)}>
          <FileDown className="mr-2 h-4 w-4" />
          Partager PDF
        </Button>
      </div>
    </div>
  );
}