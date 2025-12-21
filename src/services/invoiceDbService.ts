// services/invoiceDbService.ts
// Ce service gère les opérations CRUD avec la base de données Supabase

import { Invoice } from '@/interfaces/Invoice';
import { supabase } from '@/integrations/supabase/client';

export const invoiceDbService = {
  // Récupérer toutes les factures
  getAll: async (): Promise<Invoice[]> => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        bookings!inner (
          date_debut_prevue,
          date_fin_prevue
        )
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      throw new Error(`Error fetching invoices: ${error.message}`);
    }

    // Format the data to match the Invoice interface
    return data.map(row => ({
      id: row.id,
      invoice_number: row.invoice_number,
      date: row.date,
      due_date: row.due_date || undefined,
      booking_id: row.booking_id,
      tenant_id: row.tenant_id,
      status: row.status as Invoice['status'],
      items: JSON.parse(row.items || '[]'), // Assuming items are stored as JSON
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
      booking_dates: row.bookings ? {
        start: row.bookings.date_debut_prevue,
        end: row.bookings.date_fin_prevue
      } : undefined
    }));
  },

  // Récupérer une facture par ID
  getById: async (id: string): Promise<Invoice | null> => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        bookings!inner (
          date_debut_prevue,
          date_fin_prevue
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Row not found
        return null;
      }
      console.error('Error fetching invoice:', error);
      throw new Error(`Error fetching invoice: ${error.message}`);
    }

    // Format the data to match the Invoice interface
    return {
      id: data.id,
      invoice_number: data.invoice_number,
      date: data.date,
      due_date: data.due_date || undefined,
      booking_id: data.booking_id,
      tenant_id: data.tenant_id,
      status: data.status as Invoice['status'],
      items: JSON.parse(data.items || '[]'), // Assuming items are stored as JSON
      subtotal: Number(data.subtotal),
      discount_amount: data.discount_amount ? Number(data.discount_amount) : undefined,
      discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : undefined,
      tax_rate: data.tax_rate ? Number(data.tax_rate) : undefined,
      tax_amount: data.tax_amount ? Number(data.tax_amount) : undefined,
      total: Number(data.total),
      net_total: data.net_total ? Number(data.net_total) : undefined,
      currency: data.currency,
      notes: data.notes || undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenant_name: data.tenant_name,
      tenant_email: data.tenant_email,
      tenant_phone: data.tenant_phone,
      room_number: data.room_number,
      room_type: data.room_type,
      booking_dates: data.bookings ? {
        start: data.bookings.date_debut_prevue,
        end: data.bookings.date_fin_prevue
      } : undefined
    };
  },

  // Créer une nouvelle facture
  create: async (invoice: Invoice): Promise<Invoice> => {
    // Prepare the data for insertion
    const {
      id,
      invoice_number,
      date,
      due_date,
      booking_id,
      tenant_id,
      status,
      items,
      subtotal,
      discount_amount,
      discount_percentage,
      tax_rate,
      tax_amount,
      total,
      net_total,
      currency,
      notes,
      tenant_name,
      tenant_email,
      tenant_phone,
      room_number,
      room_type,
      booking_dates
    } = invoice;

    const { data, error } = await supabase
      .from('invoices')
      .insert([{
        id,
        invoice_number,
        date,
        due_date,
        booking_id,
        tenant_id,
        status,
        items: JSON.stringify(items), // Store items as JSON string
        subtotal,
        discount_amount,
        discount_percentage,
        tax_rate,
        tax_amount,
        total,
        net_total,
        currency,
        notes,
        tenant_name,
        tenant_email,
        tenant_phone,
        room_number,
        room_type,
        booking_start_date: booking_dates?.start,
        booking_end_date: booking_dates?.end
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      throw new Error(`Error creating invoice: ${error.message}`);
    }

    // Return the created invoice in the correct format
    return {
      id: data.id,
      invoice_number: data.invoice_number,
      date: data.date,
      due_date: data.due_date || undefined,
      booking_id: data.booking_id,
      tenant_id: data.tenant_id,
      status: data.status as Invoice['status'],
      items: JSON.parse(data.items || '[]'), // Parse the JSON string back to array
      subtotal: Number(data.subtotal),
      discount_amount: data.discount_amount ? Number(data.discount_amount) : undefined,
      discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : undefined,
      tax_rate: data.tax_rate ? Number(data.tax_rate) : undefined,
      tax_amount: data.tax_amount ? Number(data.tax_amount) : undefined,
      total: Number(data.total),
      net_total: data.net_total ? Number(data.net_total) : undefined,
      currency: data.currency,
      notes: data.notes || undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenant_name: data.tenant_name,
      tenant_email: data.tenant_email,
      tenant_phone: data.tenant_phone,
      room_number: data.room_number,
      room_type: data.room_type,
      booking_dates: booking_dates
    };
  },

  // Mettre à jour une facture
  update: async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
    // Prepare the data for update
    const updateData: Record<string, any> = { ...updates };

    if (updateData.items !== undefined) {
      updateData.items = JSON.stringify(updateData.items);
    }

    if (updateData.booking_dates !== undefined) {
      if (updateData.booking_dates.start) {
        updateData.booking_start_date = updateData.booking_dates.start;
      }
      if (updateData.booking_dates.end) {
        updateData.booking_end_date = updateData.booking_dates.end;
      }
      delete updateData.booking_dates; // Remove the object that doesn't match DB schema
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Row not found
        return null;
      }
      console.error('Error updating invoice:', error);
      throw new Error(`Error updating invoice: ${error.message}`);
    }

    // Return the updated invoice in the correct format
    return {
      id: data.id,
      invoice_number: data.invoice_number,
      date: data.date,
      due_date: data.due_date || undefined,
      booking_id: data.booking_id,
      tenant_id: data.tenant_id,
      status: data.status as Invoice['status'],
      items: JSON.parse(data.items || '[]'), // Parse the JSON string back to array
      subtotal: Number(data.subtotal),
      discount_amount: data.discount_amount ? Number(data.discount_amount) : undefined,
      discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : undefined,
      tax_rate: data.tax_rate ? Number(data.tax_rate) : undefined,
      tax_amount: data.tax_amount ? Number(data.tax_amount) : undefined,
      total: Number(data.total),
      net_total: data.net_total ? Number(data.net_total) : undefined,
      currency: data.currency,
      notes: data.notes || undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenant_name: data.tenant_name,
      tenant_email: data.tenant_email,
      tenant_phone: data.tenant_phone,
      room_number: data.room_number,
      room_type: data.room_type,
      booking_dates: data.booking_start_date && data.booking_end_date ? {
        start: data.booking_start_date,
        end: data.booking_end_date
      } : undefined
    };
  },

  // Supprimer une facture
  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invoice:', error);
      throw new Error(`Error deleting invoice: ${error.message}`);
    }

    return true;
  },

  // Rechercher des factures par critères
  search: async (filters: {
    tenantId?: string;
    bookingId?: string;
    status?: Invoice['status'];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Invoice[]> => {
    let query = supabase.from('invoices').select('*');

    if (filters.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }

    if (filters.bookingId) {
      query = query.eq('booking_id', filters.bookingId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching invoices:', error);
      throw new Error(`Error searching invoices: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      invoice_number: row.invoice_number,
      date: row.date,
      due_date: row.due_date || undefined,
      booking_id: row.booking_id,
      tenant_id: row.tenant_id,
      status: row.status as Invoice['status'],
      items: JSON.parse(row.items || '[]'), // Parse the JSON string back to array
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
      booking_dates: row.booking_start_date && row.booking_end_date ? {
        start: row.booking_start_date,
        end: row.booking_end_date
      } : undefined
    }));
  }
};