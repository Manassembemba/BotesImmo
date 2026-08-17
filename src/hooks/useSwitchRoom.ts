import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSwitchRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingId,
      newRoomId,
      switchDate,
    }: {
      bookingId: string;
      newRoomId: string;
      switchDate: string;
    }) => {
      const { data, error } = await supabase.rpc('rpc_switch_room_with_adjustment', {
        p_booking_id: bookingId,
        p_new_room_id: newRoomId,
        p_switch_date: switchDate,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Appartement changé',
        description: `Le client a été basculé avec succès. Ajustement : ${data.adjustment_amount} USD.`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Échec du changement d'appartement: ${(error as Error).message}`,
      });
    },
  });
}
