import { Room } from '@/hooks/useRooms';

export type RoomStatus = Room['status'];



export const statusTranslations: { [key in RoomStatus]: string } = {
  Libre: 'Disponible',
  Occupé: 'Occupé',
  Maintenance: 'En maintenance',
  Nettoyage: 'Disponible', // Redirection
  BOOKED: 'Réservé',
  MAINTENANCE: 'En maintenance',
  PENDING_CLEANING: 'À nettoyer',
  PENDING_CHECKOUT: 'Départ prévu',
};

export const statusColors: { [key in RoomStatus]: string } = {
  Libre: 'status-available',
  Occupé: 'status-occupied',
  Maintenance: 'status-out-of-service',
  Nettoyage: 'status-available',
  BOOKED: 'status-booked',
  MAINTENANCE: 'status-out-of-service',
  PENDING_CLEANING: 'status-cleaning',
  PENDING_CHECKOUT: 'status-pending-checkout',
};

export const getStatusLabel = (status: RoomStatus): string => {
  return statusTranslations[status] || status;
};

export const getStatusColor = (status: RoomStatus): string => {
  return statusColors[status] || 'status-available';
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
