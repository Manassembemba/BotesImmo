import { Invoice } from '@/interfaces/Invoice';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

// ... (getStatusLabel function remains the same)

// La fonction de génération HTML accepte maintenant le total payé et le breakdown en paramètre
export const generateInvoiceHTML = (
    invoice: Invoice,
    totalPaid: number,
    paidUSD: number = 0,
    paidCDF: number = 0
): string => {
    const invoiceDate = format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr });

    // Formatage des dates avec heures forcées
    const startDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy') : '';
    const startTime = '12:00'; // Toujours 12h00 pour l'entrée
    const endDate = invoice.booking_dates ? format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy') : '';
    const endTime = '11:00'; // Toujours 11h00 pour la sortie

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
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap');
            
            /* Configuration pour imprimante thermique 80mm */
            @page {
                size: 80mm auto;
                margin: 0;
            }

            body { 
                font-family: 'Roboto', Arial, sans-serif; 
                background-color: #fff; 
                margin: 0; 
                padding: 5mm; 
                width: 80mm;
                color: #000;
                font-weight: 900; /* Gras extrême pour imprimante thermique */
                font-size: 11pt;
                line-height: 1.2;
            }

            .invoice-container { 
                width: 100%; 
                background-color: #fff;
            }

            h1 { 
                font-size: 22pt; 
                margin: 0; 
                font-weight: 900; 
                text-align: center;
                border-bottom: 2pt solid #000;
                padding-bottom: 2mm;
                margin-bottom: 4mm;
            }

            .header-info {
                text-align: center;
                margin-bottom: 4mm;
            }

            .badge-number {
                display: block;
                font-size: 12pt;
                margin-top: 2mm;
            }

            .logo { 
                text-align: center;
                margin-bottom: 4mm;
            }

            .logo img {
                height: 80px; /* Logo agrandi */
                width: auto;
                margin: 0 auto;
                display: block;
            }

            .client-info { 
                margin-bottom: 4mm;
                border: 2pt solid #000;
                padding: 2mm;
            }

            .client-name { 
                font-weight: 900; 
                font-size: 13pt; 
                margin: 0 0 1mm 0; 
                text-transform: uppercase; 
            }

            .client-phone { 
                font-size: 12pt; 
                margin: 0; 
                font-weight: 900;
            }

            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 4mm; 
            }

            .date-table td { 
                border: 1pt solid #000; 
                padding: 4pt; 
                text-align: center; 
                font-weight: 900;
                font-size: 10pt;
            }

            .items-table th { 
                border: 1.5pt solid #000;
                background-color: #000; 
                color: #fff; 
                padding: 4pt; 
                text-transform: uppercase; 
                font-weight: 900;
                font-size: 9pt;
            }

            .items-table td { 
                border: 1pt solid #000; 
                padding: 6pt 4pt; 
                text-align: center; 
                font-weight: 900;
                font-size: 10pt;
            }

            .items-table td:first-child { 
                text-align: left; 
            }

            .summary { 
                margin-bottom: 4mm;
            }

            .summary-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 2pt; 
                font-weight: 900;
                font-size: 11pt;
            }

            .total-bar { 
                border: 2pt solid #000;
                padding: 4mm; 
                text-align: center; 
                font-size: 16pt; 
                font-weight: 900; 
                margin-bottom: 6mm; 
                background-color: #fff;
            }

            .footer { 
                text-align: center; 
                font-size: 11pt; 
                color: #000;
                font-weight: 900;
                margin-top: 5mm;
                padding-bottom: 10mm; /* Espace pour la coupe de l'imprimante */
            }

            .footer p { margin: 2mm 0; }

            .warning { 
                font-size: 11pt;
                text-transform: uppercase;
                border-top: 1.5pt solid #000;
                padding-top: 3mm;
                margin-top: 4mm;
            }

            .thank-you { 
                font-size: 12pt;
                margin-top: 4mm !important;
                font-weight: 900;
            }

            .legal-line { 
                border-top: 2pt solid #000; 
                margin-top: 4mm; 
                padding-top: 3mm; 
                line-height: 1.4;
                font-size: 10pt;
            }

            .phone-big { 
                font-size: 15pt; /* Numéro encore plus grand */
                font-weight: 900; 
                margin-top: 3mm; 
                border: 1.5pt solid #000;
                padding: 2mm;
            }

            /* Cacher les éléments non destinés à l'impression si nécessaire */
            @media print {
                body { padding: 0; }
                .invoice-container { padding: 2mm; }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="logo">
                    <img src="/LOGO.jpg" alt="Botes Immo">
                </div>
                <div class="header-info">
                    <span class="badge-number">FACTURE N° ${invoice.invoice_number}</span>
                    <span class="badge-date">Date: ${invoiceDate}</span>
                </div>
            </div>
            <div class="client-info">
                <p class="client-name">CLIENT: ${invoice.tenant_name || 'N/A'}</p>
                <p class="client-phone">TEL: ${invoice.tenant_phone || 'N/A'}</p>
            </div>
            <table class="date-table">
                <tr>
                    <td>ARRIVÉE</td>
                    <td>${startDate}</td>
                    <td>${startTime}</td>
                </tr>
                <tr>
                    <td>SORTIE</td>
                    <td>${endDate}</td>
                    <td>${endTime}</td>
                </tr>
            </table>
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 50%">DESC</th>
                        <th>P.U</th>
                        <th>Nuits</th>
                        <th>TOTAL</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="summary">
                <div class="summary-row">
                    <span>Réduction :</span>
                    <span>${(invoice.discount_amount || 0).toFixed(2)}$</span>
                </div>
                <div class="summary-row">
                    <span>Payé :</span>
                    <span>${totalPaid.toFixed(2)}$</span>
                </div>
                <div class="summary-row" style="font-size: 9pt;">
                    <span>USD: ${paidUSD.toFixed(2)}$ | CDF: ${paidCDF.toLocaleString()} FC</span>
                </div>
                 <div class="summary-row">
                    <span>Reste :</span>
                    <span>${remainingBalance > 0 ? remainingBalance.toFixed(2) : '0.00'}$</span>
                </div>
            </div>
            <div class="total-bar">TOTAL: ${netTotal.toFixed(2)}$</div>
            <div class="footer">
                <p class="warning">Frais non remboursables après réservation</p>
                <p class="thank-you">MERCI DE VOTRE CONFIANCE</p>
                <div class="legal-line">
                    STE BOTES GROUP SARL<br>
                    ID. Nat : 01-H5300-N52168J<br>
                    RCCM : KNM/RCCM/24-B-00077<br>
                    IMPOT : A2403025Q<br>
                    <div class="phone-big">Tél: +243 828 093 878</div>
                </div>
            </div>
        </div>
    </body>
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
        .select('montant, montant_usd, montant_cdf')
        .eq('booking_id', invoice.booking_id);

    if (error) {
        console.error("Erreur lors de la récupération des paiements:", error);
        alert("Erreur lors de la récupération des paiements.");
        return;
    }

    // 2. Calculer le total payé et le breakdown
    let totalPaid = 0;
    let paidUSD = 0;
    let paidCDF = 0;

    (payments || []).forEach(p => {
        totalPaid += p.montant;
        paidUSD += (p.montant_usd || 0);
        paidCDF += (p.montant_cdf || 0);
    });

    // 3. Générer le HTML avec le total payé et le breakdown
    const htmlContent = generateInvoiceHTML(invoice, totalPaid, paidUSD, paidCDF);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        newWindow.onload = () => {
            newWindow.print();
        };
    }
};

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ... (existing imports and generateInvoiceHTML function) ...

export const shareInvoice = async (invoice: Invoice, totalPaid: number) => {
    try {
        // Configuration pour format ticket (80mm de large)
        // La hauteur est approximative et s'ajustera, mais on part sur une base longue
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [80, 200] // Largeur 80mm fixe
        });

        const invoiceDate = format(new Date(invoice.date), 'dd/MM/yyyy');
        const netTotal = invoice.net_total || invoice.total;
        const remainingBalance = netTotal - totalPaid;

        // Police style "ticket" (Monospace ou Sans-serif simple)
        doc.setFont('helvetica');

        let y = 10;
        const centerX = 40; // Centre de 80mm
        const margin = 4;

        // --- HEADER ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text('BOTES IMMO', centerX, y, { align: 'center' });
        y += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text('Gestion des locations', centerX, y, { align: 'center' });
        y += 4;
        doc.text('Kinshasa, RDC', centerX, y, { align: 'center' });
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.text('Tel: +243 828 093 878', centerX, y, { align: 'center' });
        y += 8;

        // Ligne séparation
        doc.setLineWidth(0.5);
        doc.line(margin, y, 80 - margin, y);
        y += 5;

        // Titre Facture
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`FACTURE N ${invoice.invoice_number}`, centerX, y, { align: 'center' });
        y += 5;
        doc.setFontSize(9);
        doc.text(`Date: ${invoiceDate}`, centerX, y, { align: 'center' });
        y += 8;

        // --- CLIENT INFO ---
        doc.rect(margin, y, 80 - (margin * 2), 16); // Cadre client
        y += 4;
        doc.setFontSize(10);
        doc.text('CLIENT:', centerX, y, { align: 'center' });
        y += 5;
        doc.setFontSize(12);
        doc.text(invoice.tenant_name.toUpperCase(), centerX, y, { align: 'center' });
        y += 5;
        if (invoice.tenant_phone) {
            doc.setFontSize(9);
            doc.text(invoice.tenant_phone, centerX, y, { align: 'center' });
            y += 2;
        }
        y += 6;

        // --- PÉRIODE ---
        if (invoice.booking_dates) {
            doc.setFontSize(9);
            const start = format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy');
            const end = format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy');

            // Petit tableau simple pour les dates
            doc.text(`ARRIVEE: ${start} 12:00`, margin, y);
            y += 4;
            doc.text(`SORTIE : ${end} 11:00`, margin, y);
            y += 6;
        }

        // --- ITEMS TABLE ---
        const tableBody = invoice.items.map(item => [
            item.description,
            item.quantity.toString(),
            item.total.toFixed(0) // On arrondit pour gagner de la place si besoin, ou .toFixed(2) pour précision
        ]);

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['DESC', 'QTE', 'TOT']],
            body: tableBody,
            theme: 'plain', // Style minimaliste
            styles: {
                fontSize: 8,
                font: 'helvetica',
                cellPadding: 1,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 40 }, // Desc
                1: { cellWidth: 10, halign: 'center' }, // Qte
                2: { cellWidth: 20, halign: 'right' }, // Total
            },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 5;
        y = finalY;

        // --- TOTALS ---
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        // Fonction helper pour lignes de totaux
        const addTotalLine = (label: string, value: string, isBold: boolean = false) => {
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.text(label, margin, y);
            doc.text(value, 80 - margin, y, { align: 'right' });
            y += 4;
        };

        if (invoice.discount_amount) {
            addTotalLine('Reduction:', `-${invoice.discount_amount.toFixed(2)}$`);
        }

        addTotalLine('Paye:', `${totalPaid.toFixed(2)}$`);

        y += 2;
        doc.setLineWidth(0.5);
        doc.line(margin, y, 80 - margin, y);
        y += 5;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: ${netTotal.toFixed(2)}$`, 80 - margin, y, { align: 'right' });
        y += 8;

        if (remainingBalance > 0) {
            doc.setFontSize(10);
            doc.text(`RESTE A PAYER: ${remainingBalance.toFixed(2)}$`, 80 - margin, y, { align: 'right' });
            y += 8;
        }

        // --- FOOTER ---
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text('Frais non remboursables', centerX, y, { align: 'center' });
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.text('MERCI DE VOTRE CONFIANCE', centerX, y, { align: 'center' });
        y += 6;

        // Legal box
        doc.rect(margin, y, 80 - (margin * 2), 25);
        y += 4;
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");

        const legalLines = [
            'STE BOTES GROUP SARL',
            'ID. Nat : 01-H5300-N52168J',
            'RCCM : KNM/RCCM/24-B-00077',
            'IMPOT : A2403025Q'
        ];

        legalLines.forEach(line => {
            doc.text(line, centerX, y, { align: 'center' });
            y += 3.5;
        });

        // Set properties for printing/viewer
        doc.setProperties({
            title: `Facture ${invoice.invoice_number}`,
            subject: 'Facture de location',
            author: 'Botes Immo',
        });

        // Generate Blob
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `Facture_${invoice.invoice_number}.pdf`, { type: 'application/pdf' });

        // Vérifier si le partage de fichiers est supporté
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: `Facture ${invoice.invoice_number}`,
                    text: `Voici votre facture ${invoice.invoice_number} de chez Botes Immo.`
                });
            } catch (shareError) {
                console.warn("Le partage a été annulé ou a échoué, tentative de téléchargement...", shareError);
                // Si l'utilisateur annule ou si ça échoue, on propose le téléchargement
                if ((shareError as Error).name !== 'AbortError') {
                    downloadFile(pdfBlob, `Facture_${invoice.invoice_number}.pdf`);
                }
            }
        } else {
            // Fallback pour les navigateurs ne supportant pas le partage de fichiers
            console.log("Partage de fichier non supporté, lancement du téléchargement.");
            downloadFile(pdfBlob, `Facture_${invoice.invoice_number}.pdf`);
        }
    } catch (error) {
        console.error("Erreur critique lors de la génération/partage du PDF:", error);
        alert(`Une erreur est survenue : ${(error as Error).message}`);
    }
};

// Helper pour le téléchargement
const downloadFile = (blob: Blob, fileName: string) => {
    const pdfUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(pdfUrl);
};