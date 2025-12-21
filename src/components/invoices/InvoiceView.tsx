import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer } from 'lucide-react';
import { downloadInvoicePDF } from '@/services/invoicePdfService';

interface InvoiceViewProps {
  invoice: Invoice;
}

export function InvoiceView({ invoice }: InvoiceViewProps) {
  const invoiceDate = format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr });
  const dueDate = invoice.due_date ? format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: fr }) : null;
  
  // Détermine le badge pour le statut
  const statusBadge = () => {
    switch (invoice.status) {
      case 'PAID':
        return <Badge className="bg-green-500">Payée</Badge>;
      case 'ISSUED':
        return <Badge className="bg-yellow-500">Émise</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-500">Annulée</Badge>;
      default:
        return <Badge className="bg-blue-500">Brouillon</Badge>;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm max-w-4xl mx-auto">
      {/* En-tête de la facture */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">FACTURE</h1>
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
            <p className="text-gray-600">Début du séjour:</p>
            <p>{format(new Date(invoice.booking_dates!.start), 'dd/MM/yyyy', { locale: fr })}</p>
          </div>
          <div>
            <p className="text-gray-600">Fin du séjour:</p>
            <p>{format(new Date(invoice.booking_dates!.end), 'dd/MM/yyyy', { locale: fr })}</p>
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
          <span>{invoice.net_total?.toFixed(2) || (invoice.total - (invoice.discount_amount || 0)).toFixed(2)} {invoice.currency}</span>
        </div>
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
        <Button onClick={() => downloadInvoicePDF(invoice)}>
          <Download className="mr-2 h-4 w-4" />
          Télécharger PDF
        </Button>
      </div>
    </div>
  );
}