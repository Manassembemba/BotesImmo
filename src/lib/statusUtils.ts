import { Room } from '@/hooks/useRooms';
import { Booking } from '@/hooks/useBookings';
import { isWithinInterval, parseISO } from 'date-fns';

export type EffectiveRoomStatus = Room['status'];

export interface RoomStatusResult {
    status: EffectiveRoomStatus;
    activeBooking?: Booking;
}

/**
 * Calcule le statut effectif d'une chambre à un instant T (par défaut maintenant)
 * en combinant son statut physique (rooms.status) et ses réservations,
 * et retourne également la réservation active si elle existe.
 */
export function getEffectiveRoomStatus(
    room: Room,
    bookings: Booking[],
    checkDate: Date = new Date()
): RoomStatusResult {
    // Si la chambre est en maintenance, c'est prioritaire sur tout
    if (room.status === 'Maintenance' || room.status === 'MAINTENANCE') {
        return { status: 'Maintenance' };
    }

    // Chercher une réservation active (CONFIRMED, PENDING ou IN_PROGRESS) couvrant la date
    const activeBooking = bookings.find(b => {
        if (b.room_id !== room.id) return false;
        // Include PENDING status
        if (b.status !== 'CONFIRMED' && b.status !== 'IN_PROGRESS' && b.status !== 'COMPLETED' && b.status !== 'PENDING') return false;

        // Pour COMPLETED, on vérifie si le check-out n'est pas encore fait ou s'il est très récent
        if (b.status === 'COMPLETED' && b.check_out_reel) {
            // Si terminé et check-out fait, la chambre est libre (ou en nettoyage)
            return false;
        }

        try {
            const start = parseISO(b.date_debut_prevue);
            const end = parseISO(b.date_fin_prevue);

            // Check if we are strictly within the interval
            const isInside = isWithinInterval(checkDate, { start, end });

            // Check if it's the day of arrival (even if time hasn't passed yet)
            // This ensures rooms show as Occupied/Booked on the day guests are arriving
            const isArrivalDay = b.status !== 'COMPLETED' && start.getDate() === checkDate.getDate() && start.getMonth() === checkDate.getMonth() && start.getFullYear() === checkDate.getFullYear();

            return isInside || isArrivalDay;
        } catch (e) {
            return false;
        }
    });

    if (activeBooking) {
        try {
            const start = parseISO(activeBooking.date_debut_prevue);
            const isArrivalDay = start.getDate() === checkDate.getDate() && 
                               start.getMonth() === checkDate.getMonth() && 
                               start.getFullYear() === checkDate.getFullYear();
            
            // Si le check-in est fait, elle est Occupée
            if (activeBooking.check_in_reel) {
                return { status: 'Occupé', activeBooking };
            }

            // Si c'est le jour d'arrivée (même si le client n'est pas encore là), elle est Réservée
            if (isArrivalDay) {
                return { status: 'BOOKED', activeBooking };
            }
            
            // Par défaut pour une réservation active
            return { status: 'Occupé', activeBooking };
        } catch (e) {
            return { status: 'Occupé', activeBooking };
        }
    }

    // Si pas de réservation active du tout pour aujourd'hui, 
    // alors on regarde le statut physique.
    // Les statuts techniques de nettoyage sont convertis en "Libre" pour l'utilisateur.
    if (['Libre', 'Nettoyage', 'A_NETTOYER', 'PENDING_CLEANING'].includes(room.status)) {
        return { status: 'Libre' };
    }

    // Par défaut (ex: Maintenance), on retourne le statut tel quel (qui sera mappé à Occupé)
    return { status: room.status };
}
