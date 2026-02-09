import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLocationFilter } from '@/context/LocationFilterContext';

export interface BookingCounts {
  all: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface BookingCountsFilters {
  startDate?: string;
  endDate?: string;
}

export function useBookingCounts(filters?: BookingCountsFilters) {
  const { selectedLocationId } = useLocationFilter();

  return useQuery({
    queryKey: ['booking-counts', selectedLocationId, filters?.startDate, filters?.endDate],
    queryFn: async () => {
      // Si une localité est sélectionnée, récupérer d'abord les IDs des chambres de cette localité
      let roomIds: string[] = [];
      if (selectedLocationId) {
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('id')
          .eq('location_id', selectedLocationId);

        if (roomsError) throw roomsError;
        roomIds = roomsData?.map(r => r.id) || [];
      }

      // Fonction utilitaire pour compter les réservations avec un filtre de statut
      const countBookings = async (statusFilter: string[]) => {
        let query = supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true });

        // Appliquer le filtre de localité si nécessaire
        if (selectedLocationId && roomIds.length > 0) {
          query = query.in('room_id', roomIds);
        }

        // Appliquer les filtres de statut
        if (statusFilter.length > 0) {
          query = query.in('status', statusFilter);
        }

        // Appliquer les filtres de date
        if (filters?.startDate) {
          query = query.gte('date_fin_prevue', filters.startDate); // Les réservations qui se terminent après la date de début
        }

        if (filters?.endDate) {
          query = query.lte('date_debut_prevue', filters.endDate); // Les réservations qui commencent avant la date de fin
        }

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      };

      // Obtenir tous les totaux
      const allCount = await countBookings([]);
      const upcomingCount = await countBookings(['PENDING', 'CONFIRMED']);
      const inProgressCount = await countBookings(['IN_PROGRESS']);
      const completedCount = await countBookings(['COMPLETED']);
      const cancelledCount = await countBookings(['CANCELLED']);

      return {
        all: allCount,
        upcoming: upcomingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        cancelled: cancelledCount,
      };
    },
  });
}