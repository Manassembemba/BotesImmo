import { Room } from '@/hooks/useRooms';

export type RoomStatus = Room['status'];

import { RoomStatus } from '@/types/room';

export const statusTranslations: { [key in RoomStatus]: string } = {
  Libre: 'Disponible',
  Occupé: 'Occupé',
  Nettoyage: 'Nettoyage',
  Maintenance: 'En maintenance',
};

export const statusColors: { [key in RoomStatus]: string } = {
  Libre: 'status-available',
  Occupé: 'status-occupied',
  Nettoyage: 'status-pending-cleaning',
  Maintenance: 'status-out-of-service',
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
