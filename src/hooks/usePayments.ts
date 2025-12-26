import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Payment {
  id: string;
  booking_id: string;
  invoice_id: string | null;
  montant: number;
  date_paiement: string;
  methode: 'CB' | 'CASH' | 'TRANSFERT' | 'CHEQUE';
  notes: string | null;
  created_at: string;
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
  return useQuery({
    queryKey: ['allPayments'], // Clé plus spécifique
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*');
      
      if (error) throw error;
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
