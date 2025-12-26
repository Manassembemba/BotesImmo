import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePayment } from './usePayments'; // Import useCreatePayment
import { useGenerateInvoiceForBooking } from './useInvoices';
import { format, differenceInDays } from 'date-fns'; // Import format for date formatting

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

export interface BookingFilters {
  searchTerm?: string;
  status?: string[];
  startDate?: string;
  endDate?: string;
}

export function useBookings(filters?: BookingFilters, pagination?: { pageIndex: number; pageSize: number; }) {
  const { pageIndex = 0, pageSize = 15 } = pagination || {};

  return useQuery({
    queryKey: ['bookings', filters, pagination],
    queryFn: async () => {
      const rangeFrom = pageIndex * pageSize;
      const rangeTo = rangeFrom + pageSize - 1;

      let query = supabase
        .from('bookings')
        .select(`
          *,
          rooms (numero, type),
          tenants (nom, prenom, email, telephone, id_document)
        `, { count: 'exact' });

      if (filters?.searchTerm) {
        const search = `%${filters.searchTerm.toLowerCase()}%`;
        query = query.or(`tenants.nom.ilike.${search},tenants.prenom.ilike.${search},rooms.numero.ilike.${search}`);
      }

      if (filters?.status && filters.status.length > 0 && !filters.status.includes('all')) {
        const formattedStatuses = filters.status.map(s => s.toUpperCase().replace('-', '_'));
        query = query.in('status', formattedStatuses);
      }

      if (filters?.startDate && filters?.endDate) {
        query = query.lt('date_debut_prevue', filters.endDate);
        query = query.gt('date_fin_prevue', filters.startDate);
      }

      query = query.order('date_debut_prevue', { ascending: false }).range(rangeFrom, rangeTo);

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as Booking[], count: count ?? 0 };
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
          p_caution_encaissee: 0,
          p_notes: booking.notes,
          p_date_fin_prevue: new Date(booking.date_fin_prevue).toISOString(),
        };
        const { data, error } = await supabase.rpc('create_booking_and_checkin', rpcParams).single();
        if (error) throw error;
        return { booking: data, isImmediate, initialPaymentAmount, discountAmount };
      } else {
        // Workflow for Future Booking
        const { discount_amount, initial_payment, caution_encaissee, ...bookingData } = booking as any;

        const { data, error } = await supabase
          .from('bookings')
          .insert({ 
            ...bookingData, 
            agent_id: user.id,
            caution_encaissee: 0,
            date_debut_prevue: new Date(booking.date_debut_prevue).toISOString(),
            date_fin_prevue: new Date(booking.date_fin_prevue).toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return { booking: data, isImmediate, initialPaymentAmount, discountAmount };
      }
    },
    onSuccess: async ({ booking: newBooking, isImmediate, initialPaymentAmount, discountAmount }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      let newInvoiceId: string | null = null;
      let invoiceCreationFailed = false;

      // Step 1: Generate Invoice First
      try {
        const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', newBooking.tenant_id).single();
        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', newBooking.room_id).single();
        
        if (tenantData && roomData) {
          const createdInvoice = await generateInvoice.generateForBooking(newBooking, tenantData, roomData, discountAmount, initialPaymentAmount);
          newInvoiceId = createdInvoice.id;
        } else {
           throw new Error("Données du locataire ou de la chambre introuvables pour la facturation.");
        }
      } catch (error) {
        invoiceCreationFailed = true;
        toast({ variant: 'destructive', title: 'Erreur de facturation', description: `La réservation est faite, mais la génération de la facture a échoué. Détails: ${(error as Error).message}` });
      }

      // Step 2: Create Initial Payment and link it to the invoice
      const paymentAmount = initialPaymentAmount || 0;
      if (paymentAmount > 0 && newInvoiceId) {
        try {
          await createPayment.mutateAsync({
            booking_id: newBooking.id,
            invoice_id: newInvoiceId,
            montant: paymentAmount,
            methode: 'CASH',
            date_paiement: format(new Date(), "yyyy-MM-dd"),
            notes: isImmediate ? 'Paiement pour check-in direct' : 'Acompte de réservation',
          });
        } catch (error) {
          toast({ variant: 'destructive', title: 'Erreur de paiement', description: `La réservation et la facture sont faites, mais l'enregistrement du paiement a échoué.` });
        }
      }

      if (!invoiceCreationFailed) {
        toast({ title: 'Opération réussie!', description: `La réservation a été enregistrée, la facture et le paiement initial ont été traités.` });
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



export function useConfirmDeparture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ bookingId, roomId }: { bookingId: string, roomId: string }) => {
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase.rpc('confirm_departure_and_cleanup', {
        p_booking_id: bookingId,
        p_room_id: roomId,
        p_agent_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate tasks as a new one is created
      toast({ title: 'Départ confirmé', description: `Le départ a été confirmé et une tâche de nettoyage a été créée.` });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: `Erreur lors de la confirmation du départ: ${error.message}` });
    },
  });
}

export function useExtendStay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, newEndDate, newTotalBookingPrice, extensionDiscountPerNight }: {
      bookingId: string,
      newEndDate: string,
      newTotalBookingPrice: number,
      extensionDiscountPerNight: number, // Nouveau paramètre
    }) => {
      
      const { data, error } = await supabase.functions.invoke('extend-stay', {
        body: { 
          p_booking_id: bookingId,
          p_new_date_fin_prevue: newEndDate,
          p_new_prix_total: newTotalBookingPrice,
          p_extension_discount_per_night: extensionDiscountPerNight, // Passer la réduction par nuit
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Invalidate invoices for this booking to show the new extension invoice
      if (data && data.id) {
          queryClient.invalidateQueries({ queryKey: ['invoices', { bookingId: data.id }] });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] }); // Also invalidate the general invoices list

      toast({
        title: 'Séjour prolongé avec succès',
        description: `La réservation a été prolongée. Une facture a été créée pour la période additionnelle.`,
      });
    },
    onError: (error) => {
      console.error('Erreur lors de la prolongation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de prolongation',
        description: error.message || 'Une erreur inconnue est survenue.',
      });
    },
  });
}
