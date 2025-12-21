import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePayment } from './usePayments'; // Import useCreatePayment
import { useGenerateInvoiceForBooking } from './useInvoices';
import { differenceInDays } from 'date-fns'; // Import differenceInDays
import { format } from 'date-fns'; // Import format for date formatting

export interface Booking {
  id: string;
  room_id: string;
  tenant_id: string;
  agent_id: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  check_in_reel: string | null;
  check_out_reel: string | null;
  prix_total: number;
  caution_encaissee: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined data
  rooms?: {
    numero: string;
    type: string;
  };
  tenants?: {
    nom: string;
    prenom: string;
    email: string | null;
    telephone: string | null;
    id_document: string | null;
  };
}

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          rooms (numero, type),
          tenants (nom, prenom, email, telephone, id_document)
        `)
        .order('date_debut_prevue', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const createPayment = useCreatePayment();
  const generateInvoice = useGenerateInvoiceForBooking();

  return useMutation({
    mutationFn: async ({ booking, isImmediate, initialPaymentAmount = 0, discountAmount = 0 }: {
      booking: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'agent_id' | 'rooms' | 'tenants'>;
      isImmediate: boolean;
      initialPaymentAmount?: number;
      discountAmount?: number;
    }) => {
      if (!user) throw new Error('Non authentifié');

      if (isImmediate) {
        // Workflow for Immediate Check-in
        const rpcParams = {
          p_room_id: booking.room_id,
          p_tenant_id: booking.tenant_id,
          p_agent_id: user.id,
          p_prix_total: booking.prix_total,
          p_caution_encaissee: 0, // Always 0 now
          p_notes: booking.notes,
          p_date_fin_prevue: new Date(booking.date_fin_prevue).toISOString(),
        };
        const { data, error } = await supabase.rpc('create_booking_and_checkin', rpcParams).single();
        if (error) throw error;
        return { booking: data, isImmediate, initialPaymentAmount, discountAmount };
      } else {
        // Workflow for Future Booking
        // Destructure to remove fields that are not in the 'bookings' table
        const { discount_amount, initial_payment, caution_encaissee, ...bookingData } = booking;

        const { data, error } = await supabase
          .from('bookings')
          .insert({ 
            ...bookingData, 
            agent_id: user.id,
            caution_encaissee: 0, // Always 0 now
            date_debut_prevue: new Date(booking.date_debut_prevue).toISOString(),
            date_fin_prevue: new Date(booking.date_fin_prevue).toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        // Pass the original discount/initial payment amounts to the onSuccess handler
        return { booking: data, isImmediate, initialPaymentAmount, discountAmount };
      }
    },
    onSuccess: async ({ booking: newBooking, isImmediate, initialPaymentAmount, discountAmount }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      // Logic for creating payment and invoice, now with discount
      const paymentAmount = initialPaymentAmount || 0;
      
      if (paymentAmount > 0) {
        try {
          await createPayment.mutateAsync({
            booking_id: newBooking.id,
            montant: paymentAmount,
            methode: 'CASH',
            date_paiement: format(new Date(), "yyyy-MM-dd"),
            notes: isImmediate ? 'Paiement pour check-in direct' : 'Acompte de réservation',
          });
        } catch (error) {
          toast({ variant: 'destructive', title: 'Erreur de paiement', description: `La réservation est faite, mais l'enregistrement du paiement a échoué.` });
        }
      }

      try {
        const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', newBooking.tenant_id).single();
        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', newBooking.room_id).single();
        
        if (tenantData && roomData) {
          await generateInvoice.generateForBooking(newBooking, tenantData, roomData, discountAmount);
        }
        toast({ title: 'Opération réussie!', description: `La réservation a été enregistrée et une facture a été générée.` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erreur de facturation', description: `La réservation est faite, mais la génération de la facture a échoué.` });
      }
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...booking }: Partial<Booking> & { id: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update(booking)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Réservation mise à jour', description: 'Les modifications ont été enregistrées' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Réservation supprimée', description: 'La réservation a été supprimée' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useExtendStay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // TODO: Add invoice/payment logic for the extension
  
  return useMutation({
    mutationFn: async ({ bookingId, newEndDate, newPrice }: { bookingId: string, newEndDate: string, newPrice: number }) => {
      const { data, error } = await supabase.rpc('extend_stay', {
        p_booking_id: bookingId,
        p_new_date_fin_prevue: new Date(newEndDate).toISOString(),
        p_new_prix_total: newPrice,
      }).single();

      if (error) throw error;
      return data as Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      
      toast({
        title: 'Séjour prolongé',
        description: `La réservation a été mise à jour avec la nouvelle date de fin.`,
      });
      // Future improvement: Automatically create a new invoice and/or payment for the extension
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur de prolongation',
        description: error.message,
      });
    },
  });
}
