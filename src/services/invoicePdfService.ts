import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ... (getStatusLabel function remains the same)

// La fonction de génération HTML accepte maintenant le total payé et le breakdown en paramètre
export const generateInvoiceHTML = (
    invoice: Invoice,
    totalPaid: number,
    paidUSD: number = 0,
    paidCDF: number = 0
): string => {
    const invoiceDate = invoice.date ? format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr }) : '';

    // Formatage des dates avec heures forcées
    const startDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy') : '';
    const startTime = '12:00'; // Toujours 12h00 pour l'entrée
    const endDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy') : '';
    const endTime = '11:00'; // Toujours 11h00 pour la sortie

    const netTotal = invoice.net_total || invoice.total;
    const remainingBalance = netTotal - totalPaid;

    const itemsHTML = (invoice.items || []).map(item => `
    <tr>
        <td>${item.description}</td>
        <td>${item.unit_price.toFixed(2)}$</td>
        <td>${item.quantity}</td>
        <td>${item.total.toFixed(2)}$</td>
    </tr>
  `).join('');

    return `
    <div id="invoice-thermal-template" style="width: 80mm; font-family: 'Roboto', Arial, sans-serif; background-color: #fff; padding: 5mm; color: #000; font-weight: 900; font-size: 11pt; line-height: 1.2;">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap');
            .thermal-container { width: 100%; }
            .logo-thermal { text-align: center; margin-bottom: 4mm; }
            .logo-thermal img { height: 80px; width: auto; display: block; margin: 0 auto; }
            .header-info-thermal { text-align: center; margin-bottom: 4mm; }
            .badge-number-thermal { display: block; font-size: 12pt; margin-top: 2mm; }
            .client-info-thermal { margin-bottom: 4mm; border: 2pt solid #000; padding: 2mm; }
            .client-name-thermal { font-weight: 900; font-size: 13pt; margin: 0 0 1mm 0; text-transform: uppercase; }
            .date-table-thermal { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
            .date-table-thermal td { border: 1pt solid #000; padding: 4pt; text-align: center; font-weight: 900; font-size: 10pt; }
            .items-table-thermal { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
            .items-table-thermal th { border: 1.5pt solid #000; background-color: #000; color: #fff; padding: 4pt; text-transform: uppercase; font-weight: 900; font-size: 9pt; }
            .items-table-thermal td { border: 1pt solid #000; padding: 6pt 4pt; text-align: center; font-weight: 900; font-size: 10pt; }
            .items-table-thermal td:first-child { text-align: left; }
            .summary-thermal { margin-bottom: 4mm; }
            .summary-row-thermal { display: flex; justify-content: space-between; margin-bottom: 2pt; font-weight: 900; font-size: 11pt; }
            .total-bar-thermal { border: 2pt solid #000; padding: 4mm; text-align: center; font-size: 16pt; font-weight: 900; margin-bottom: 6mm; background-color: #fff; }
            .footer-thermal { text-align: center; font-size: 11pt; color: #000; font-weight: 900; margin-top: 5mm; }
            .legal-line-thermal { border-top: 2pt solid #000; margin-top: 4mm; padding-top: 3mm; line-height: 1.4; font-size: 10pt; }
            .phone-big-thermal { font-size: 15pt; font-weight: 900; margin-top: 3mm; border: 1.5pt solid #000; padding: 2mm; }
        </style>
        <div class="thermal-container">
            <div class="logo-thermal">
                <img src="/LOGO.jpg" alt="Botes Immo">
            </div>
            <div class="header-info-thermal">
                <span class="badge-number-thermal">FACTURE N° ${invoice.invoice_number}</span>
                <span class="badge-date-thermal">Date: ${invoiceDate}</span>
            </div>
            <div class="client-info-thermal">
                <p class="client-name-thermal">CLIENT: ${invoice.tenant_name || 'N/A'}</p>
                <p class="client-phone-thermal">TEL: ${invoice.tenant_phone || 'N/A'}</p>
            </div>
            <table class="date-table-thermal">
                <tr><td>ARRIVÉE</td><td>${startDate}</td><td>${startTime}</td></tr>
                <tr><td>SORTIE</td><td>${endDate}</td><td>${endTime}</td></tr>
            </table>
            <table class="items-table-thermal">
                <thead><tr><th>DESC</th><th>P.U</th><th>Nuits</th><th>TOTAL</th></tr></thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="summary-thermal">
                <div class="summary-row-thermal"><span>Réduction :</span><span>${(invoice.discount_amount || 0).toFixed(2)}$</span></div>
                <div class="summary-row-thermal"><span>Payé :</span><span>${totalPaid.toFixed(2)}$</span></div>
                <div class="summary-row-thermal" style="font-size: 9pt;"><span>USD: ${paidUSD.toFixed(2)}$ | CDF: ${paidCDF.toLocaleString()} FC</span></div>
                <div class="summary-row-thermal"><span>Reste :</span><span>${remainingBalance > 0 ? remainingBalance.toFixed(2) : '0.00'}$</span></div>
            </div>
            <div class="total-bar-thermal">TOTAL: ${netTotal.toFixed(2)}$</div>
            <div class="footer-thermal">
                <p style="text-transform: uppercase;">Frais non remboursables après réservation</p>
                <p style="font-size: 12pt; margin-top: 4mm;">MERCI DE VOTRE CONFIANCE</p>
                <div class="legal-line-thermal">
                    STE BOTES GROUP SARL<br>
                    ID. Nat : 01-H5300-N52168J<br>
                    RCCM : KNM/RCCM/24-B-00077<br>
                    IMPOT : A2403025Q<br>
                    <div class="phone-big-thermal">Tél: +243 828 093 878</div>
                </div>
            </div>
        </div>
    </div>
    `;
};

export const downloadInvoicePDF = async (invoice: Invoice) => {
    if (!invoice.booking_id) {
        alert("Impossible de générer la facture sans réservation associée.");
        return;
    }

    const { data: payments, error } = await supabase
        .from('payments')
        .select('montant, montant_usd, montant_cdf')
        .eq('booking_id', invoice.booking_id);

    if (error) {
        console.error("Erreur paiements:", error);
        alert("Erreur lors de la récupération des paiements.");
        return;
    }

    let totalPaid = 0, paidUSD = 0, paidCDF = 0;
    (payments || []).forEach(p => {
        totalPaid += p.montant;
        paidUSD += (p.montant_usd || 0);
        paidCDF += (p.montant_cdf || 0);
    });

    const htmlContent = generateInvoiceHTML(invoice, totalPaid, paidUSD, paidCDF);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(`
            <html>
                <head><title>Facture ${invoice.invoice_number}</title></head>
                <body style="margin:0; padding:0;">${htmlContent}</body>
            </html>
        `);
        newWindow.document.close();
        newWindow.onload = () => {
            newWindow.print();
        };
    }
};

export const shareInvoice = async (invoice: Invoice, totalPaid: number) => {
    const netTotal = invoice.net_total || invoice.total;
    const remainingBalance = netTotal - totalPaid;

    const text = `*FACTURE BOTES IMMO*\n` +
        `---------------------------\n` +
        `Ref: ${invoice.invoice_number}\n` +
        `Client: ${invoice.tenant_name}\n` +
        `Chambre: ${invoice.room_number} (${invoice.room_type})\n` +
        `Période: ${invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy') : ''} au ${invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy') : ''}\n` +
        `---------------------------\n` +
        `TOTAL: ${netTotal.toFixed(2)}$\n` +
        `PAYÉ: ${totalPaid.toFixed(2)}$\n` +
        `RESTE: ${remainingBalance > 0 ? remainingBalance.toFixed(2) : '0.00'}$` +
        `\n---------------------------\n` +
        `Merci de votre confiance!`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `Facture ${invoice.invoice_number}`,
                text: text,
            });
        } catch (error) {
            console.error("Erreur partage:", error);
        }
    } else {
        try {
            await navigator.clipboard.writeText(text);
            alert("Détails copiés !");
        } catch (err) {
            console.error("Erreur clipboard:", err);
        }
    }
};

export const shareInvoiceAsPDF = async (invoice: Invoice) => {
    if (!invoice.booking_id) return;

    // Récupérer les paiements
    const { data: payments } = await supabase
        .from('payments')
        .select('montant, montant_usd, montant_cdf')
        .eq('booking_id', invoice.booking_id);

    let totalPaid = 0, paidUSD = 0, paidCDF = 0;
    (payments || []).forEach(p => {
        totalPaid += p.montant;
        paidUSD += (p.montant_usd || 0);
        paidCDF += (p.montant_cdf || 0);
    });

    const htmlContent = generateInvoiceHTML(invoice, totalPaid, paidUSD, paidCDF);

    // Créer un élément invisible pour le rendu
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        const pdf = new jsPDF({
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const pdfBlob = pdf.output('blob');
        const fileName = `Facture_${invoice.invoice_number}.pdf`;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `Facture ${invoice.invoice_number}`,
                text: `Voici votre facture Botes Immo : ${invoice.invoice_number}`,
            });
        } else {
            pdf.save(fileName);
            alert("Le PDF a été téléchargé car le partage direct n'est pas supporté sur cet appareil.");
        }
    } catch (error) {
        console.error("Erreur PDF:", error);
        alert("Une erreur est survénue lors de la génération du PDF.");
    } finally {
        document.body.removeChild(container);
    }
};