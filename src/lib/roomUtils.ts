import { Room } from '@/hooks/useRooms';

export type RoomStatus = Room['status'];



export const statusTranslations: { [key in RoomStatus]: string } = {
  Libre: 'Libre',
  Nettoyage: 'Libre',
  A_NETTOYER: 'Libre',
  PENDING_CLEANING: 'Libre',
  Occupé: 'Occupé',
  PENDING_CHECKOUT: 'Occupé',
  Maintenance: 'Occupé', // Indisponible donc considéré comme occupé
  MAINTENANCE: 'Occupé',
  BOOKED: 'Réservée',
};

export const statusColors: { [key in RoomStatus]: string } = {
  Libre: 'status-available',
  Nettoyage: 'status-available',
  A_NETTOYER: 'status-available',
  PENDING_CLEANING: 'status-available',
  Occupé: 'status-occupied',
  PENDING_CHECKOUT: 'status-occupied',
  Maintenance: 'status-occupied',
  MAINTENANCE: 'status-occupied',
  BOOKED: 'status-booked',
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
