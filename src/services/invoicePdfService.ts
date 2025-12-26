import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

// ... (getStatusLabel function remains the same)

// La fonction de génération HTML accepte maintenant le total payé en paramètre
export const generateInvoiceHTML = (invoice: Invoice, totalPaid: number): string => {
  const invoiceDate = format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr });
  const startDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy') : '';
  const startTime = invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'HH:mm') : '';
  const endDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy') : '';
  const endTime = invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'HH:mm') : '';
  
  const netTotal = invoice.net_total || invoice.total;
  const remainingBalance = netTotal - totalPaid;

  const itemsHTML = invoice.items.map(item => `
    <tr>
        <td>${item.description}</td>
        <td>${item.unit_price.toFixed(2)}$</td>
        <td>${item.quantity}</td>
        <td>${item.total.toFixed(2)}$</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Facture - ${invoice.invoice_number}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
            body { font-family: 'Roboto', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; display: flex; justify-content: center; }
            .invoice-container { background-color: #fffaf7; width: 100%; max-width: 700px; padding: 40px; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header-left h1 { font-size: 48px; margin: 0; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; }
            .header-left .badges { display: flex; gap: 10px; margin-top: 10px; }
            .header-left .badge { border: 1px solid #333; border-radius: 20px; padding: 5px 15px; font-size: 14px; font-weight: 500; }
            .logo { display: flex; align-items: center; gap: 10px; }
            .logo-icon { width: 40px; height: 40px; background-color: #0070c0; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; }
            .logo-text { font-size: 24px; font-weight: 700; color: #333; line-height: 1; }
            .logo-text span { display: block; font-weight: 300; color: #0070c0; letter-spacing: 2px; }
            .client-info { margin-bottom: 20px; }
            .client-name { font-weight: 700; font-size: 18px; margin: 0 0 5px 0; text-transform: uppercase; }
            .client-phone { font-size: 16px; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
            .date-table td { border: 1px solid #777; padding: 8px 15px; background-color: #f2f2f2; text-align: center; }
            .date-table td:first-child { text-align: left; width: 40%; }
            .items-table th { background-color: #0070c0; color: white; padding: 8px; text-transform: uppercase; font-weight: 500; border: 1px solid #0056b3; }
            .items-table td { border: 1px solid #777; padding: 10px; text-align: center; font-weight: 700; background-color: #f2f2f2; }
            .items-table td:first-child { text-align: left; font-weight: 500; }
            .summary { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 10px; padding-right: 10px; }
            .summary-row { display: flex; justify-content: space-between; width: 220px; margin-bottom: 5px; font-weight: 700; }
            .total-bar { background-color: #0070c0; color: white; padding: 10px; text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 40px; }
            .footer { text-align: center; font-size: 12px; color: #000; }
            .footer p { margin: 5px 0; }
            .warning { font-weight: 700; margin-bottom: 20px !important; font-size: 14px; }
            .thank-you { margin-bottom: 20px !important; text-transform: uppercase; }
            .legal-line { border-top: 1px solid #777; margin-top: 10px; padding-top: 10px; line-height: 1.4; }
            .phone-big { font-size: 16px; font-weight: 700; margin-top: 5px; }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="header-left">
                    <h1>FACTURE</h1>
                    <div class="badges">
                        <span class="badge">Facture n°${invoice.invoice_number}</span>
                        <span class="badge">${invoiceDate}</span>
                    </div>
                </div>
                <div class="logo">
                    <img src="/LOGO.jpg" alt="Botes Immo" style="height: 60px; border-radius: 8px;">
                </div>
            </div>
            <div class="client-info">
                <p class="client-name">${invoice.tenant_name || 'N/A'}</p>
                <p class="client-phone">${invoice.tenant_phone || 'N/A'}</p>
            </div>
            <table class="date-table">
                <tr>
                    <td>Date et Heure d'arrivée</td>
                    <td>${startDate}</td>
                    <td>${startTime}</td>
                </tr>
                <tr>
                    <td>Date et Heure de sortie</td>
                    <td>${endDate}</td>
                    <td>${endTime}</td>
                </tr>
            </table>
            <table class="items-table">
                <thead>
                    <tr><th>DESCRIPTION</th><th>PRIX</th><th>NUITÉE</th><th>TOTAL</th></tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="summary">
                <div class="summary-row">
                    <span>Réduction :</span>
                    <span>${(invoice.discount_amount || 0).toFixed(2)}$</span>
                </div>
                <div class="summary-row">
                    <span>Montant Payé :</span>
                    <span>${totalPaid.toFixed(2)}$</span>
                </div>
                 <div class="summary-row">
                    <span>Reste à payer :</span>
                    <span>${remainingBalance > 0 ? remainingBalance.toFixed(2) : '0.00'}$</span>
                </div>
            </div>
            <div class="total-bar">TOTAL: ${netTotal.toFixed(2)}$</div>
            <div class="footer">
                <p class="warning">Après la réservation les frais ne sont pas remboursables</p>
                <p class="thank-you">MERCI DE VOTRE CONFIANCE</p>
                <div class="legal-line">
                    STE BOTES GROUP SARL ID. Nat : 01-H5300-N52168J<br>
                    RCCM : KNM/RCCM/24-B-00077 NUM. IMPOT : A2403025Q<br>
                    <div class="phone-big">+243 828 093 878</div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

export const downloadInvoicePDF = async (invoice: Invoice) => {
  if (!invoice.booking_id) {
    alert("Impossible de générer la facture sans réservation associée.");
    return;
  }

  // 1. Récupérer les paiements liés à la réservation
  const { data: payments, error } = await supabase
    .from('payments')
    .select('montant')
    .eq('booking_id', invoice.booking_id);

  if (error) {
    console.error("Erreur lors de la récupération des paiements:", error);
    alert("Erreur lors de la récupération des paiements.");
    return;
  }

  // 2. Calculer le total payé
  const totalPaid = (payments || []).reduce((sum, p) => sum + p.montant, 0);

  // 3. Générer le HTML avec le total payé
  const htmlContent = generateInvoiceHTML(invoice, totalPaid);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    newWindow.onload = () => {
      newWindow.print();
    };
  }
};