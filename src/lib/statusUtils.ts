import { Room } from '@/hooks/useRooms';
import { Booking } from '@/hooks/useBookings';
import { isWithinInterval, parseISO } from 'date-fns';

export type EffectiveRoomStatus = Room['status'];

/**
 * Calcule le statut effectif d'une chambre à un instant T (par défaut maintenant)
 * en combinant son statut physique (rooms.status) et ses réservations.
 */
export function getEffectiveRoomStatus(
    room: Room,
    bookings: Booking[],
    checkDate: Date = new Date()
): EffectiveRoomStatus {
    // Si la chambre est en maintenance, c'est prioritaire sur tout
    if (room.status === 'Maintenance' || room.status === 'MAINTENANCE') {
        return 'Maintenance';
    }

    // Chercher une réservation active (CONFIRMED ou IN_PROGRESS) couvrant la date
    const activeBooking = bookings.find(b => {
        if (b.room_id !== room.id) return false;
        if (b.status !== 'CONFIRMED' && b.status !== 'IN_PROGRESS' && b.status !== 'COMPLETED') return false;

        // Pour COMPLETED, on vérifie si le check-out n'est pas encore fait ou s'il est très récent
        if (b.status === 'COMPLETED' && b.check_out_reel) {
            // Si terminé et check-out fait, la chambre est libre (ou en nettoyage)
            return false;
        }

        try {
            const start = parseISO(b.date_debut_prevue);
            const end = parseISO(b.date_fin_prevue);

            return isWithinInterval(checkDate, { start, end });
        } catch (e) {
            return false;
        }
    });

    if (activeBooking) {
        return 'Occupé';
    }

    // Si pas de réservation active, on retourne le statut physique
    // (Nettoyage est maintenant traité comme Libre)
    return room.status === 'Nettoyage' ? 'Libre' : room.status;
}
