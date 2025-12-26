export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  date: string; // ISO date string
  due_date?: string; // ISO date string
  booking_id: string;
  tenant_id: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'PARTIALLY_PAID';
  items: InvoiceItem[];
  subtotal: number;
  discount_amount?: number; // Discount amount in currency
  discount_percentage?: number; // Discount percentage
  tax_rate?: number; // Tax rate as percentage (e.g., 16 for 16%)
  tax_amount?: number;
  total: number; // Total before discounts
  net_total?: number; // Total after discounts applied
  currency: string; // USD, CDF, etc.
  notes?: string;
  created_at: string;
  updated_at: string;
  // Tenant details (filled from booking/tenant data)
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  // Booking details (filled from booking data)
  booking_dates?: { start: string; end: string };
  room_number?: string;
  room_type?: string;
  amount_paid?: number;
  balance_due?: number;
}

export interface InvoiceFormData {
  booking_id: string;
  notes?: string;
  due_date?: string;
  tax_rate?: number;
  discount_amount?: number;
  discount_percentage?: number;
  status?: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'PARTIALLY_PAID';
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
}