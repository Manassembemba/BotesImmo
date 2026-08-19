import { Invoice } from '@/interfaces/Invoice';
import { supabase } from '@/integrations/supabase/client';

export const invoiceDbService = {
  // Récupérer toutes les factures avec filtres et pagination
  getAll: async (options?: {
    filters?: { search?: string; status?: string; dateRange?: { start?: string; end?: string; }; bookingId?: string; locationId?: string | null };
    pagination?: { pageIndex: number; pageSize: number; };
  }) => {
    const { filters = {}, pagination = { pageIndex: 0, pageSize: 15 } } = options || {};
    const { pageIndex, pageSize } = pagination;
    const rangeFrom = pageIndex * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
      .from('invoices')
      .select(`
        *,
        bookings!inner (
          date_debut_prevue,
          date_fin_prevue,
          rooms!inner (
            location_id
          )
        )
      `, { count: 'exact' });

    // Filter by location if provided
    if (filters.locationId) {
      query = query.eq('bookings.rooms.location_id', filters.locationId);
    }

    if (filters.search) {
      const search = `%${filters.search}%`;
      query = query.or(`invoice_number.ilike.${search},tenant_name.ilike.${search},room_number.ilike.${search}`);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status.toUpperCase());
    } else {
      query = query.in('status', ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'PARTIALLY_PAID']);
    }
    if (filters.dateRange?.start) {
      query = query.gte('date', filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query = query.lte('date', filters.dateRange.end);
    }
    if (filters.bookingId) {
      query = query.eq('booking_id', filters.bookingId);
    }

    query = query.order('date', { ascending: false }).range(rangeFrom, rangeTo);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      throw new Error(`Error fetching invoices: ${error.message}`);
    }

    const formattedData: Invoice[] = (data || []).map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      date: row.date,
      due_date: row.due_date || undefined,
      booking_id: row.booking_id,
      tenant_id: row.tenant_id,
      status: row.status as Invoice['status'],
      items: (row.items as any) || [],
      subtotal: Number(row.subtotal),
      discount_amount: row.discount_amount ? Number(row.discount_amount) : undefined,
      discount_percentage: row.discount_percentage ? Number(row.discount_percentage) : undefined,
      tax_rate: row.tax_rate ? Number(row.tax_rate) : undefined,
      tax_amount: row.tax_amount ? Number(row.tax_amount) : undefined,
      total: Number(row.total),
      net_total: row.net_total ? Number(row.net_total) : undefined,
      currency: row.currency,
      notes: row.notes || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tenant_name: row.tenant_name,
      tenant_email: row.tenant_email,
      tenant_phone: row.tenant_phone,
      room_number: row.room_number,
      room_type: row.room_type,
      amount_paid: Number(row.amount_paid || 0),
      balance_due: Number(row.balance_due || (Number(row.net_total || row.total) - Number(row.amount_paid || 0))),
      booking_dates: row.bookings ? {
        start: row.bookings.date_debut_prevue,
        end: row.bookings.date_fin_prevue
      } : undefined
    }));

    return { data: formattedData, count: count ?? 0 };
  },

  getById: async (id: string): Promise<Invoice | null> => {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return {
      ...data,
      items: ((data as any).items as any) || []
    } as Invoice;
  },

  create: async (invoice: Invoice): Promise<Invoice> => {
    const {
      id, invoice_number, date, due_date, booking_id, tenant_id, status, items, subtotal, discount_amount,
      discount_percentage, tax_rate, tax_amount, total, net_total, currency, notes, tenant_name,
      tenant_email, tenant_phone, room_number, room_type, booking_dates, amount_paid // Removed balance_due
    } = invoice;

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        id, invoice_number, date, due_date, booking_id, tenant_id, status,
        items: items as any,
        subtotal, discount_amount, discount_percentage, tax_rate, tax_amount, total, net_total,
        currency, notes, tenant_name, tenant_email, tenant_phone, room_number, room_type,
        booking_start_date: booking_dates?.start,
        booking_end_date: booking_dates?.end,
        amount_paid,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice in DB:', error);
      throw error;
    }

    return {
      ...data,
      items: ((data as any).items as any) || []
    } as Invoice;
  },

  update: async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
    const { booking_dates, items, balance_due, ...rest } = updates;

    const dbUpdates: any = { ...rest };

    if (booking_dates) {
      dbUpdates.booking_start_date = booking_dates.start;
      dbUpdates.booking_end_date = booking_dates.end;
    }

    if (items) {
      dbUpdates.items = items as any;
    }

    const { data, error } = await supabase.from('invoices').update(dbUpdates).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return {
      ...data,
      items: ((data as any).items as any) || []
    } as Invoice;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
