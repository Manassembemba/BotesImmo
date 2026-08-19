import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocationFilter } from '@/context/LocationFilterContext';

export interface Payment {
  id: string;
  booking_id: string;
  invoice_id: string | null;
  montant: number; // Total équivalent USD
  montant_usd: number; // 🔥 Physique USD
  montant_cdf: number; // 🔥 Physique CDF
  exchange_rate: number; // 🔥 Taux utilisé au moment du paiement
  date_paiement: string;
  methode: string; // Changed to string to match RPC return type
  notes: string | null;
  created_at: string;
  // Joined data from RPC
  location_id?: string;
  room_numero?: string;
  tenant_nom?: string;
  tenant_prenom?: string;
}

export function usePaymentsByBooking(bookingId: string) {
  return useQuery({
    queryKey: ['payments', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!bookingId,
  });
}

export function usePaymentsByInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['payments', 'invoice', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!invoiceId,
  });
}

export function usePaymentsForBookings(bookingIds: string[]) {
  return useQuery({
    queryKey: ['payments', 'forBookings', bookingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds);

      if (error) throw error;
      return data as Payment[];
    },
    enabled: bookingIds && bookingIds.length > 0,
  });
}

export function useAllPayments() {
  const { selectedLocationId, userLocationId } = useLocationFilter();

  return useQuery({
    queryKey: ['allPayments', selectedLocationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_payments_with_details', {
        p_location_id: selectedLocationId || null,
      });

      if (error) {
        console.error('RPC Error in useAllPayments:', error);
        throw error;
      }
      return data as Payment[];
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payment: Omit<Payment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('payments')
        .insert(payment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Paiement enregistré', description: 'Le paiement a été ajouté avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, booking_id, ...payment }: Partial<Payment> & { id: string, booking_id: string }) => {
      const { data, error } = await supabase
        .from('payments')
        .update(payment)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, booking_id };
    },
    onSuccess: ({ booking_id }) => {
      queryClient.invalidateQueries({ queryKey: ['payments', booking_id] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });

      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Paiement mis à jour', description: 'Le paiement a été modifié avec succès.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, booking_id }: { id: string, booking_id: string }) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { booking_id };
    },
    onSuccess: ({ booking_id }) => {
      queryClient.invalidateQueries({ queryKey: ['payments', booking_id] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Paiement supprimé', description: 'Le paiement a été supprimé avec succès.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}