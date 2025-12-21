import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Booking } from './useBookings';
import { Tenant } from './useTenants';
import { Room } from './useRooms';
import { Invoice, InvoiceFormData } from '@/interfaces/Invoice';
import { generateInvoiceFromBooking } from '@/services/invoiceService';
import { invoiceDbService } from '@/services/invoiceDbService';

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return invoiceDbService.getAll();
    },
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['invoices', invoiceId],
    queryFn: async () => {
      return invoiceDbService.getById(invoiceId);
    },
    enabled: !!invoiceId,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ booking, tenant, room, formData }: {
      booking: Booking;
      tenant: Tenant;
      room?: Room;
      formData?: InvoiceFormData;
    }) => {
      // Générer la facture à partir de la réservation
      const invoice = generateInvoiceFromBooking(booking, tenant, room, formData);

      // Créer la facture dans la base de données
      return invoiceDbService.create(invoice);
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Facture créée',
        description: `La facture ${invoice.invoice_number} a été générée avec succès.`
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

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...update }: { id: string } & Partial<Invoice>) => {
      // Mettre à jour la facture dans la base de données
      const updated = await invoiceDbService.update(id, update);
      if (!updated) {
        throw new Error(`Facture avec ID ${id} introuvable`);
      }
      return updated;
    },
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', updatedInvoice.id] });
      toast({
        title: 'Facture mise à jour',
        description: `La facture ${updatedInvoice.invoice_number} a été mise à jour.`
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la mise à jour de la facture: ${(error as Error).message}`
      });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Supprimer la facture de la base de données
      const success = await invoiceDbService.delete(id);
      if (!success) {
        throw new Error(`Échec de la suppression de la facture avec ID ${id}`);
      }
      return success;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', deletedId] });
      toast({
        title: 'Facture supprimée',
        description: `La facture a été supprimée avec succès.`
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec de la suppression de la facture: ${(error as Error).message}`
      });
    },
  });
}

export function useGenerateInvoiceForBooking() {
  const createInvoice = useCreateInvoice();

  const generateForBooking = async (booking: Booking, tenant: Tenant, room?: Room, discountAmount = 0) => {
    return createInvoice.mutateAsync({
      booking,
      tenant,
      room,
      formData: {
        booking_id: booking.id,
        due_date: booking.date_fin_prevue, // Date de fin de séjour par défaut
        discount_amount: discountAmount,
      }
    });
  };

  return {
    ...createInvoice,
    generateForBooking
  };
}