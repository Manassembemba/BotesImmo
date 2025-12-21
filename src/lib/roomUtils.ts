import { Room } from '@/hooks/useRooms';

export type RoomStatus = Room['status'];

export const getStatusLabel = (status: RoomStatus): string => {
  const labels: Record<RoomStatus, string> = {
    AVAILABLE: 'Disponible',
    BOOKED: 'Réservée',
    OCCUPIED: 'Occupée',
    PENDING_CHECKOUT: 'Départ en attente',
    PENDING_CLEANING: 'Nettoyage en attente',
    MAINTENANCE: 'Hors service',
  };
  return labels[status];
};

export const getStatusColor = (status: RoomStatus): string => {
  const colors: Record<RoomStatus, string> = {
    AVAILABLE: 'status-available',
    BOOKED: 'status-occupied',
    OCCUPIED: 'status-occupied',
    PENDING_CHECKOUT: 'status-pending-checkout',
    PENDING_CLEANING: 'status-pending-cleaning',
    MAINTENANCE: 'status-out-of-service',
  };
  return colors[status];
};

export const getRoomTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    SINGLE: 'Simple',
    DOUBLE: 'Double',
    SUITE: 'Suite',
    STUDIO: 'Studio',
  };
  return labels[type] || type;
};
