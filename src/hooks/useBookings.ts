import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useExchangeRate } from './useExchangeRate';
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
    nom: string | null;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
    id_document: string | null;
  };
  booking_financial_summary?: {
    total_invoiced: number;
    total_paid: number;
    balance_due: number;
    payment_summary_status: string;
  }[];
}

export interface BookingFilters {
  searchTerm?: string;
  status?: string[];
  startDate?: string;
  endDate?: string;
  tenantId?: string;
}

import { useLocationFilter } from '@/context/LocationFilterContext';

export function useBookings(filters?: BookingFilters, pagination?: { pageIndex: number; pageSize: number; }) {
  const { pageIndex = 0, pageSize = 15 } = pagination || {};
  const { selectedLocationId, userLocationId } = useLocationFilter();

  return useQuery({
    queryKey: ['bookings', filters, pagination, selectedLocationId],
    queryFn: async () => {
      const rangeFrom = pageIndex * pageSize;
      const formattedStatuses = filters?.status && filters.status.length > 0 && !filters.status.includes('all')
        ? filters.status.map(s => s.toUpperCase().replace('-', '_'))
        : null;

      const { data, error, count } = await supabase.rpc('get_bookings_with_financials', {
        p_search_term: filters?.searchTerm || null,
        p_status: formattedStatuses,
        p_start_date: filters?.startDate || null,
        p_end_date: filters?.endDate || null,
        p_offset: rangeFrom,
        p_limit: pageSize,
        p_location_id: selectedLocationId || null,
        p_tenant_id: filters?.tenantId || null
      }, { count: 'exact' });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      // Map the flat RPC response to the nested Booking interface
      const mappedData = data.map((b: any) => {
        const {
          room_number,
          room_type,
          tenant_nom,
          tenant_prenom,
          tenant_email,
          tenant_telephone,
          total_factures,
          total_paiements,
          reste_a_payer,
          statut_paiement,
          agent_email,
          location_name,
          ...restOfBooking
        } = b;

        return {
          ...restOfBooking,
          rooms: {
            numero: room_number,
            type: room_type,
          },
          tenants: {
            nom: tenant_nom,
            prenom: tenant_prenom,
            email: tenant_email,
            telephone: tenant_telephone,
          },
          booking_financial_summary: [
            {
              total_invoiced: total_factures,
              total_paid: total_paiements,
              balance_due: reste_a_payer,
              payment_summary_status: statut_paiement,
            },
          ],
        };
      });

      return { data: mappedData as Booking[], count: count ?? 0 };
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: exchangeRateData } = useExchangeRate();

  return useMutation({
    mutationFn: async ({
      booking,
      isImmediate,
      initialPaymentAmount,
      discountAmount,
      initialPaymentUSD,
      initialPaymentCDF
    }: {
      booking: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'rooms' | 'agent_id' | 'tenants'>;
      isImmediate: boolean;
      initialPaymentAmount?: number;
      discountAmount?: number;
      initialPaymentUSD?: number;
      initialPaymentCDF?: number;
    }) => {
      if (!user) throw new Error('Non authentifié');

      const exchangeRate = exchangeRateData?.usd_to_cdf;
      if (!exchangeRate || exchangeRate <= 0) {
        throw new Error('Taux de change invalide ou non disponible. Impossible de continuer.');
      }

      const { data, error } = await supabase.rpc('create_booking_with_invoice_atomic', {
        p_room_id: booking.room_id,
        p_tenant_id: booking.tenant_id,
        p_agent_id: user.id,
        p_date_debut_prevue: new Date(booking.date_debut_prevue).toISOString(),
        p_date_fin_prevue: new Date(booking.date_fin_prevue).toISOString(),
        p_prix_total: booking.prix_total,
        p_caution_encaissee: 0,
        p_notes: booking.notes,
        p_discount_per_night: discountAmount || 0,
        p_initial_payment_usd: initialPaymentUSD || 0,
        p_initial_payment_cdf: initialPaymentCDF || 0,
        p_exchange_rate: exchangeRate,
        p_payment_method: 'CASH',
        p_is_immediate_checkin: isImmediate
      });

      if (error) throw error;
      return { ...data, isImmediate };
    },
    onSuccess: async () => {
      // Refresh all related data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast({
        title: 'Opération réussie!',
        description: `La réservation, la facture et le paiement éventuel ont été traités de manière sécurisée.`
      });
    },
    onError: (error) => {
      console.error('Erreur lors de la création atomique:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la création de la réservation.'
      });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...booking }: Partial<Booking> & { id: string }) => {
      const { data, error } = await supabase.rpc('update_booking_with_invoice_atomic', {
        p_booking_id: id,
        p_date_debut_prevue: booking.date_debut_prevue,
        p_date_fin_prevue: booking.date_fin_prevue,
        p_prix_total: booking.prix_total,
        p_notes: booking.notes,
        p_status: booking.status
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Réservation mise à jour', description: 'Les modifications et la facture associée ont été synchronisées.' });
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
      const { data, error } = await supabase.rpc('delete_booking_with_invoice_atomic', {
        p_booking_id: id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Réservation supprimée', description: 'La réservation et ses factures (non payées) ont été retirées.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}




export function useCheckIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, check_in_reel }: { id: string; check_in_reel: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          check_in_reel,
          status: 'CONFIRMED',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
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
    mutationFn: async ({ bookingId, roomId, debtAmount, overdueDays }: { bookingId: string, roomId: string, debtAmount?: number, overdueDays?: number }) => {
      if (!user) throw new Error('Non authentifié');

      console.log('Confirming departure with:', { bookingId, roomId, userId: user.id, debtAmount, overdueDays });

      if (!bookingId || !roomId || !user.id) {
        throw new Error('Les identifiants (Booking, Room, User) sont incomplets.');
      }

      const { data, error } = await supabase.rpc('confirm_departure_and_cleanup', {
        p_booking_id: bookingId,
        p_room_id: roomId,
        p_agent_id: user.id,
        p_debt_amount: debtAmount || 0,
        p_overdue_days: overdueDays || 0,
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      };
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
      extensionDiscountPerNight: number,
    }) => {
      const { data, error } = await supabase.rpc('extend_stay_atomic', {
        p_booking_id: bookingId,
        p_new_date_fin_prevue: newEndDate,
        p_new_prix_total: newTotalBookingPrice,
        p_extension_discount_per_night: extensionDiscountPerNight,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['booking-financial-summary', variables.bookingId] });

      toast({
        title: 'Séjour prolongé avec succès',
        description: `La réservation a été prolongée et la facture d'extension générée.`,
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
