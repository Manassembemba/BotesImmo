import { Booking } from '@/hooks/useBookings';
import { Tenant } from '@/hooks/useTenants';
import { Room } from '@/hooks/useRooms';
import { Invoice, InvoiceFormData, InvoiceItem, InvoiceLineItem } from '@/interfaces/Invoice';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';

// Génère un numéro de facture unique
export const generateInvoiceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const randomNum = Math.floor(100 + Math.random() * 900); // 3 digits random number

  return `FACT-${year}${month}${day}-${randomNum}`;
};

// Calcule les détails d'une facture basés sur une réservation
export const calculateInvoiceItems = (booking: Booking, room: Room): InvoiceLineItem[] => {
  const items: InvoiceLineItem[] = [];

  const startDate = new Date(booking.date_debut_prevue);
  const endDate = new Date(booking.date_fin_prevue);
  const nights = differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate));

  if (nights > 0) {
    items.push({
      description: `Location ${room.type} - ${nights} nuits du ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`,
      quantity: nights,
      unit_price: room.prix_base_nuit // Utiliser directement le prix de base de la chambre
    });
  }
  
  if (booking.caution_encaissee && booking.caution_encaissee > 0) {
    items.push({
      description: 'Caution',
      quantity: 1,
      unit_price: booking.caution_encaissee
    });
  }

  return items;
};

// Calcule les totaux d'une facture
export const calculateInvoiceTotals = ( 
  items: InvoiceLineItem[], 
  tax_rate?: number,
  discount_amount?: number,
  discount_percentage?: number
) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  let tax_amount = 0;
  if (tax_rate && tax_rate > 0) {
    tax_amount = (subtotal * tax_rate) / 100;
  }

  const total = subtotal + tax_amount;

  // Calculer les réductions
  let appliedDiscount = 0;
  if (discount_percentage && discount_percentage > 0) {
    appliedDiscount = total * (discount_percentage / 100);
  } else if (discount_amount && discount_amount > 0) {
    appliedDiscount = Math.min(discount_amount, total); // Ne pas autoriser une réduction supérieure au total
  }

  const net_total = total - appliedDiscount;

  return { subtotal, tax_amount, total, discount_amount: appliedDiscount, net_total };
};

// Génère une facture à partir d'une réservation
export const generateInvoiceFromBooking = (
  booking: Booking,
  tenant: Tenant,
  room: Room,
  formData?: InvoiceFormData
): Invoice => {
  try {
    // 1. Calculer les lignes de la facture (nuitées, caution, etc.)
    const items = calculateInvoiceItems(booking, room);
    const nights = differenceInCalendarDays(startOfDay(new Date(booking.date_fin_prevue)), startOfDay(new Date(booking.date_debut_prevue)));

    // 2. Calculer la réduction totale (réduction par nuit * nombre de nuits)
    const perNightDiscount = formData?.discount_amount || 0;
    const totalDiscount = nights * perNightDiscount;
    
    // 3. Calculer tous les totaux en utilisant la réduction totale
    const { 
      subtotal, 
      tax_amount, 
      total, 
      discount_amount: appliedDiscount, 
      net_total 
    } = calculateInvoiceTotals(
      items, 
      formData?.tax_rate, 
      totalDiscount // Utiliser la réduction totale ici
    );

    // 4. Déterminer le statut de la facture
    const status: Invoice['status'] = formData?.status || ((formData?.initial_payment ?? 0) >= net_total ? 'PAID' : 'DRAFT');

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: generateInvoiceNumber(),
      date: new Date().toISOString(),
      due_date: formData?.due_date || booking.date_fin_prevue,
      booking_id: booking.id,
      tenant_id: booking.tenant_id,
      status: status, // Utiliser le statut dynamique
      items: items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price
      })),
      subtotal,
      tax_rate: formData?.tax_rate,
      tax_amount,
      total, // Total brut avant réduction
      discount_amount: appliedDiscount, // Réduction appliquée
      discount_percentage: total > 0 ? (appliedDiscount / total) * 100 : 0,
      net_total, // Total net après réduction
      amount_paid: formData?.initial_payment || 0, // Initialisation de amount_paid
      currency: 'USD',
      notes: formData?.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant_name: `${tenant.prenom} ${tenant.nom}`,
      tenant_email: tenant.email || undefined,
      tenant_phone: tenant.telephone || undefined,
      booking_dates: { start: booking.date_debut_prevue, end: booking.date_fin_prevue },
      room_number: room?.numero || booking.rooms?.numero,
      room_type: room?.type || booking.rooms?.type
    };

    return invoice;
  } catch (error) {
    console.error("Erreur lors de la construction de l'objet facture:", error);
    throw error; // Re-jeter l'erreur pour qu'elle soit gérée par le hook d'appel
  }
};

// Fonction utilitaire pour formater une facture en objet affichable
export const formatInvoiceForDisplay = (invoice: Invoice): any => {
  return {
    ...invoice,
    formatted_date: format(new Date(invoice.date), 'dd/MM/yyyy'),
    formatted_due_date: invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : undefined,
    formatted_total: invoice.total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_subtotal: invoice.subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_tax_amount: invoice.tax_amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_net_total: invoice.net_total?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_discount_amount: invoice.discount_amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  };
};

// Fonction pour convertir des factures en format pouvant être exporté (CSV, Excel, etc.)
export const exportInvoiceData = (invoices: Invoice[]): any[] => {
  return invoices.map(invoice => ({
    'N° Facture': invoice.invoice_number,
    'Date': format(new Date(invoice.date), 'dd/MM/yyyy'),
    'Client': invoice.tenant_name,
    'Email Client': invoice.tenant_email || '',
    'Téléphone Client': invoice.tenant_phone || '',
    'Chambre': `${invoice.room_number} (${invoice.room_type})`,
    'Période de séjour': invoice.booking_dates 
      ? `${format(new Date(invoice.booking_dates.start), 'dd/MM/yyyy')} - ${format(new Date(invoice.booking_dates.end), 'dd/MM/yyyy')}`
      : '',
    'Montant TTC': invoice.total,
    'Réduction Montant': invoice.discount_amount || 0,
    'Réduction (%)': invoice.discount_percentage || 0,
    'Total Net': invoice.net_total || invoice.total,
    'Devise': invoice.currency,
    'Statut': translateStatus(invoice.status),
    'Total HT': invoice.subtotal,
    'Taxe': invoice.tax_amount || 0,
    'Taux Taxe': invoice.tax_rate || 0,
    'Date Échéance': invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : ''
  }));
};

// Fonction pour traduire les statuts de facture
const translateStatus = (status: Invoice['status']): string => {
  const translations: Record<Invoice['status'], string> = {
    DRAFT: 'Brouillon',
    ISSUED: 'Émise',
    PAID: 'Payée',
    CANCELLED: 'Annulée'
  };
  return translations[status] || status;
};