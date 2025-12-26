import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Function to convert data to CSV format
export const exportFinancialReportToCsv = (invoices: Invoice[], filters: any) => {
  const headers = [
    "N° Facture", "Client", "Date", "Montant Net", "Payé", "Dû", "Statut",
    "Début Réservation", "Fin Réservation", "Type Chambre", "N° Chambre"
  ];

  const rows = invoices.map(invoice => [
    invoice.invoice_number,
    invoice.tenant_name,
    format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr }),
    (invoice.net_total || invoice.total).toFixed(2),
    invoice.amount_paid.toFixed(2),
    (invoice.balance_due || 0).toFixed(2),
    invoice.status,
    invoice.booking_dates?.start ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy', { locale: fr }) : '',
    invoice.booking_dates?.end ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy', { locale: fr }) : '',
    invoice.room_type,
    invoice.room_number
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `rapport_financier_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Function to generate PDF (using print for simplicity)
export const exportFinancialReportToPdf = (invoices: Invoice[], filters: any) => {
  const title = "Rapport Financier Complet";
  const dateGenerated = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${title}</title>
        <style>
            body { font-family: 'Helvetica Neue', 'Helvetica', Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { font-size: 18px; text-align: center; margin-bottom: 20px; }
            h2 { font-size: 14px; margin-top: 15px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .text-right { text-align: right; }
            .summary-card { border: 1px solid #ddd; border-radius: 5px; padding: 10px; margin-bottom: 20px; background-color: #fcfcfc;}
            .summary-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .summary-item strong { font-size: 12px; }
            .summary-total { border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px; font-size: 14px; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>${title}</h1>
        <p>Généré le: ${dateGenerated}</p>
        <h2>Filtres appliqués</h2>
        <p>Recherche: ${filters.search || 'N/A'}</p>
        <p>Statut: ${filters.status || 'N/A'}</p>
        <p>Période: ${filters.dateRange.start && filters.dateRange.end ? `${filters.dateRange.start} au ${filters.dateRange.end}` : 'N/A'}</p>
        
        <h2>Statistiques agrégées</h2>
        <div class="summary-card">
            <div class="summary-item"><span>Total net facturé:</span> <strong>${invoices.reduce((sum, inv) => sum + (inv.net_total || inv.total), 0).toFixed(2)} USD</strong></div>
            <div class="summary-item"><span>Total payé:</span> <strong>${invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0).toFixed(2)} USD</strong></div>
            <div class="summary-item summary-total"><span>Solde restant:</span> <strong>${(invoices.reduce((sum, inv) => sum + (inv.net_total || inv.total), 0) - invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)).toFixed(2)} USD</strong></div>
        </div>

        <h2>Détails des factures</h2>
        <table>
            <thead>
                <tr>
                    <th>N° Facture</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Montant Net</th>
                    <th>Payé</th>
                    <th>Dû</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                ${invoices.map(invoice => `
                    <tr>
                        <td>${invoice.invoice_number}</td>
                        <td>${invoice.tenant_name}</td>
                        <td>${format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })}</td>
                        <td class="text-right">${(invoice.net_total || invoice.total).toFixed(2)} ${invoice.currency}</td>
                        <td class="text-right">${invoice.amount_paid.toFixed(2)} ${invoice.currency}</td>
                        <td class="text-right">${(invoice.balance_due || 0).toFixed(2)} ${invoice.currency}</td>
                        <td>${invoice.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }
};
