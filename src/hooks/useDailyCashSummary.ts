import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface DailyCashEntry {
  date: string;
  location_id: string;
  location_name: string;
  total_usd: number;
  total_cdf: number;
  total_equivalent_usd: number;
  nombre_paiements: number;
  methodes_utilisees: string[];
}

/**
 * Retourne le résumé de caisse du jour courant par localité,
 * TOUJOURS pour TOUS les sites (sans filtre de localité).
 * Ceci assure que le total du dashboard est toujours correct pour l'ADMIN.
 */
export function useTodaysCashSummary() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['todaysCashSummary', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caisse_daily_summary')
        .select('*')
        .eq('date', todayStr);

      if (error) {
        console.error('Error fetching caisse_daily_summary:', error);
        throw error;
      }

      return (data || []).map(row => ({
        ...row,
        total_usd: Number(row.total_usd) || 0,
        total_cdf: Number(row.total_cdf) || 0,
        total_equivalent_usd: Number(row.total_equivalent_usd) || 0,
        nombre_paiements: Number(row.nombre_paiements) || 0,
        methodes_utilisees: Array.isArray(row.methodes_utilisees)
          ? row.methodes_utilisees
          : [],
      })) as DailyCashEntry[];
    },
    // Rafraîchir toutes les 60 secondes pour capturer les nouveaux paiements
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
