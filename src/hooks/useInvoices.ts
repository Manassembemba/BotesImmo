import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Booking } from './useBookings';
import { Tenant } from './useTenants';
import { Room } from './useRooms';
import { Invoice, InvoiceFormData } from '@/interfaces/Invoice';
import { generateInvoiceFromBooking } from '@/services/invoiceService';
import { invoiceDbService } from '@/services/invoiceDbService';

export function useInvoices(options?: {
  filters?: { search?: string; status?: string; dateRange?: { start?: string; end?: string; }; bookingId?: string; };
  pagination?: { pageIndex: number; pageSize: number; };
}) {
  const { filters, pagination } = options || {};

  return useQuery({
    queryKey: ['invoices', filters, pagination],
    queryFn: () => invoiceDbService.getAll({ filters, pagination }),
    enabled: !!filters, // Ensure query only runs when filters are provided
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ booking, tenant, room, formData }: {
      booking: Booking;
      tenant: Tenant;
      room: Room;
      formData?: InvoiceFormData;
    }) => {
      const invoice = generateInvoiceFromBooking(booking, tenant, room, formData);
      return invoiceDbService.create(invoice);
    },
    onSuccess: (data) => {
      // Invalidate all queries that start with 'invoices' to refresh all lists
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Facture créée',
        description: `La facture a été générée avec succès.`
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la création de la facture: ${(error as Error).message}`
      });
    },
  });
}

export function useGenerateInvoiceForBooking() {
  const createInvoice = useCreateInvoice();

  const generateForBooking = async (booking: Booking, tenant: Tenant, room: Room, discountAmount = 0, initialPaymentAmount = 0) => {
    return createInvoice.mutateAsync({
      booking,
      tenant,
      room,
      formData: {
        booking_id: booking.id,
        due_date: booking.date_fin_prevue,
        discount_amount: discountAmount,
        initial_payment: initialPaymentAmount,
      }
    });
  };

  return {
    ...createInvoice,
    generateForBooking
  };
}

// ... autres hooks (useUpdateInvoice, useDeleteInvoice, etc)