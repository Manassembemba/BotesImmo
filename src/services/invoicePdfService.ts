import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Fonction pour générer une facture au format HTML qui peut être converti en PDF
export const generateInvoiceHTML = (invoice: Invoice): string => {
  const invoiceDate = format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr });
  const dueDate = invoice.due_date ? format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: fr }) : null;
  const startDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy', { locale: fr }) : '';
  const endDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy', { locale: fr }) : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Facture ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .header-left img { height: 80px; width: auto; }
        .header-right { text-align: right; }
        .invoice-title { font-size: 24px; font-weight: bold; margin: 20px 0; color: #1e3a8a; }
        .invoice-details { display: flex; justify-content: space-between; margin: 30px 0; }
        .from-section, .to-section { width: 45%; }
        .section-title { font-weight: bold; margin-bottom: 10px; }
        .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .items-table th { background-color: #f3f4f6; padding: 10px; text-align: left; border: 1px solid #e5e7eb; }
        .items-table td { padding: 10px; border: 1px solid #e5e7eb; }
        .items-table tr:nth-child(even) { background-color: #f9fafb; }
        .totals { width: 300px; margin-left: auto; margin-top: 30px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-weight: bold; border-top: 1px solid #d1d5db; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin-top: 10px; }
        .paid { background-color: #dcfce7; color: #166534; }
        .issued { background-color: #dbeafe; color: #1e40af; }
        .draft { background-color: #e5e7eb; color: #374151; }
        .cancelled { background-color: #fee2e2; color: #991b1b; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <img src="${window.location.origin}/LOGO.jpg" alt="Botes Immo" style="height: 60px; border-radius: 8px;">
        </div>
        <div class="header-right">
          <h1 class="invoice-title">FACTURE</h1>
          <div>N°: ${invoice.invoice_number}</div>
          <div>Date: ${invoiceDate}</div>
          <div>${dueDate ? 'Échéance: ' + dueDate : ''}</div>
          <div class="status-badge ${invoice.status.toLowerCase()}">${getStatusLabel(invoice.status)}</div>
        </div>
      </div>
      
      <div class="invoice-details">
        <div class="from-section">
          <div class="section-title">Émise par:</div>
          <div>Botes Immo</div>
          <div>Gestion des locations</div>
          <div>Kinshasa, RDC</div>
        </div>
        <div class="to-section">
          <div class="section-title">Émise à:</div>
          <div>${invoice.tenant_name}</div>
          ${invoice.tenant_email ? `<div>${invoice.tenant_email}</div>` : ''}
          ${invoice.tenant_phone ? `<div>${invoice.tenant_phone}</div>` : ''}
        </div>
      </div>
      
      <div class="section-title">Détails de la réservation:</div>
      <div>Réservation du ${startDate} au ${endDate}</div>
      <div>Chambre: ${invoice.room_number} (${invoice.room_type})</div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qté</th>
            <th>Prix unitaire</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${item.unit_price.toFixed(2)} ${invoice.currency}</td>
              <td>${item.total.toFixed(2)} ${invoice.currency}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="totals-row">
          <div>Sous-total:</div>
          <div>${invoice.subtotal.toFixed(2)} ${invoice.currency}</div>
        </div>
        ${invoice.tax_amount ? `
        <div class="totals-row">
          <div>Taxe (${invoice.tax_rate}%):</div>
          <div>${invoice.tax_amount.toFixed(2)} ${invoice.currency}</div>
        </div>
        ` : ''}
        <div class="total-row">
          <div>Total:</div>
          <div>${invoice.total.toFixed(2)} ${invoice.currency}</div>
        </div>
      </div>
      
      ${invoice.notes ? `
      <div class="section-title" style="margin-top: 30px;">Notes:</div>
      <div>${invoice.notes}</div>
      ` : ''}
      
      <div class="footer">
        Ce document est une facture électronique valide. Il ne nécessite pas de signature manuscrite.
      </div>
    </body>
    </html>
  `;
};

// Fonction pour obtenir le libellé du statut
function getStatusLabel(status: string): string {
  switch(status) {
    case 'PAID': return 'Payée';
    case 'ISSUED': return 'Émise';
    case 'DRAFT': return 'Brouillon';
    case 'CANCELLED': return 'Annulée';
    default: return status;
  }
}

// Fonction pour télécharger la facture en tant que PDF
export const downloadInvoicePDF = async (invoice: Invoice) => {
  // Créer une fenêtre temporaire avec le contenu HTML de la facture
  const htmlContent = generateInvoiceHTML(invoice);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    // Attendre que le document soit chargé avant d'imprimer
    newWindow.onload = () => {
      newWindow.print();
    };
  }
};