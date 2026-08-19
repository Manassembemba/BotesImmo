import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { BookingFilters } from './useBookings';

export function useBookingCount(filters?: BookingFilters) {
  const { selectedLocationId } = useLocationFilter();

  return useQuery({
    queryKey: ['booking-count', filters, selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*', { count: 'exact', head: true });

      // Appliquer le filtre de localité si applicable
      if (selectedLocationId) {
        // On doit joindre avec la table rooms pour filtrer par localité
        // On suppose que bookings a un champ room_id qui référence rooms
        const { data: roomIds, error: roomError } = await supabase
          .from('rooms')
          .select('id')
          .eq('location_id', selectedLocationId);

        if (roomError) {
          console.error('Room filter error:', roomError);
          throw roomError;
        }

        if (roomIds && roomIds.length > 0) {
          const ids = roomIds.map(r => r.id);
          query = query.in('room_id', ids);
        } else {
          // Si aucune chambre n'est trouvée pour cette localité, retourner 0
          return 0;
        }
      }

      // Appliquer le filtre de statut
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // Appliquer le filtre de recherche (sur les champs pertinents)
      if (filters?.searchTerm) {
        // On suppose que la recherche se fait sur les champs liés aux locataires
        // Pour l'instant, on fait une recherche simple sur un champ hypothétique
        // Dans une implémentation réelle, il faudrait une jointure avec la table des locataires
        query = query.ilike('id', `%${filters.searchTerm}%`); // Recherche sur l'ID pour l'instant
      }

      // Appliquer les filtres de date
      if (filters?.startDate) {
        query = query.gte('date_fin_prevue', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('date_debut_prevue', filters.endDate);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Booking count error:', error);
        throw error;
      }

      return count ?? 0;
    },
  });
}