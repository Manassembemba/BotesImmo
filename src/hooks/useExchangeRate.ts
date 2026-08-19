import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExchangeRateData {
  usd_to_cdf: number;
}

export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'exchange_rate')
        .maybeSingle();

      if (error) throw error;
      
      const defaultRate = { usd_to_cdf: 2800 };
      if (!data || !data.value) return defaultRate;
      
      const value = data.value as unknown as ExchangeRateData;
      return value.usd_to_cdf ? value : defaultRate;
    },
  });
}

export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newRate: number) => {
      // Use upsert to create or update the exchange rate setting
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key: 'exchange_rate', value: { usd_to_cdf: newRate } },
          { onConflict: 'key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      toast.success('Taux de change mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour du taux');
      console.error('Exchange rate update error:', error);
    },
  });
}
