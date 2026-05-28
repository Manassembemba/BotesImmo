/**
 * Centralisation des statuts de réservation pour garantir la cohérence
 * dans toute l'application (Réservations, Planning, Dashboard).
 */

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'PENDING_CHECKOUT' | 'COMPLETED' | 'CANCELLED';

export interface StatusStyle {
  label: string;
  className: string;
  bg: string;
  text: string;
  light: string;
  border: string;
  icon: string;
}

export const STATUS_CONFIG: Record<BookingStatus, StatusStyle> = {
  PENDING: {
    label: 'Réservée',
    className: 'status-badge bg-yellow-100 text-yellow-700',
    bg: 'bg-yellow-500',
    text: 'text-black',
    light: 'bg-yellow-100',
    border: 'border-yellow-600',
    icon: 'border-yellow-500'
  },
  CONFIRMED: {
    label: 'Réservée',
    className: 'status-badge bg-yellow-100 text-yellow-700',
    bg: 'bg-yellow-500',
    text: 'text-black',
    light: 'bg-yellow-100',
    border: 'border-yellow-600',
    icon: 'border-yellow-500'
  },
  IN_PROGRESS: {
    label: 'Occupé',
    className: 'status-badge bg-blue-100 text-blue-700',
    bg: 'bg-blue-600',
    text: 'text-white',
    light: 'bg-blue-100',
    border: 'border-blue-700',
    icon: 'border-blue-600'
  },
  PENDING_CHECKOUT: {
    label: 'Occupé',
    className: 'status-badge bg-blue-100 text-blue-700',
    bg: 'bg-blue-600',
    text: 'text-white',
    light: 'bg-blue-100',
    border: 'border-blue-700',
    icon: 'border-blue-600'
  },
  COMPLETED: {
    label: 'Terminée',
    className: 'status-badge bg-gray-100 text-gray-700',
    bg: 'bg-gray-400',
    text: 'text-white',
    light: 'bg-gray-100',
    border: 'border-gray-500',
    icon: 'border-gray-400'
  },
  CANCELLED: {
    label: 'Annulée',
    className: 'status-badge bg-red-100 text-red-700',
    bg: 'bg-slate-900',
    text: 'text-white',
    light: 'bg-slate-200',
    border: 'border-slate-800',
    icon: 'border-slate-900'
  },
};

/**
 * Mapping des statuts vers des catégories simplifiées utilisées dans le Planning
 */
export const MAP_STATUS_TO_CATEGORY: Record<BookingStatus, string> = {
  PENDING: 'UPCOMING',
  CONFIRMED: 'UPCOMING',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_CHECKOUT: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const CATEGORY_CONFIG: Record<string, StatusStyle> = {
  UPCOMING: {
    label: 'Réservée',
    className: 'bg-yellow-100 text-yellow-700',
    bg: 'bg-yellow-500',
    text: 'text-black',
    light: 'bg-yellow-100',
    border: 'border-yellow-600',
    icon: 'border-yellow-500'
  },
  IN_PROGRESS: {
    label: 'Occupé',
    className: 'bg-blue-100 text-blue-700',
    bg: 'bg-blue-600',
    text: 'text-white',
    light: 'bg-blue-100',
    border: 'border-blue-700',
    icon: 'border-blue-600'
  },
  COMPLETED: STATUS_CONFIG.COMPLETED,
  CANCELLED: STATUS_CONFIG.CANCELLED,
};

/**
 * Configuration des styles pour les statuts physiques des chambres
 */
export const ROOM_STATUS_CONFIG: Record<string, { bg: string; tint: string }> = {
  Libre: { bg: 'bg-emerald-500', tint: 'bg-emerald-50/20' },
  Occupé: { bg: 'bg-blue-500', tint: 'bg-blue-50/30' },
  Maintenance: { bg: 'bg-blue-500', tint: 'bg-blue-50/30' },
  MAINTENANCE: { bg: 'bg-blue-500', tint: 'bg-blue-50/30' },
  PENDING_CHECKOUT: { bg: 'bg-blue-500', tint: 'bg-blue-50/30' },
  BOOKED: { bg: 'bg-yellow-500', tint: 'bg-yellow-50/20' },
};

/**
 * Mapping inverse des catégories vers les statuts originaux (pour le filtrage)
 */
export const MAP_CATEGORY_TO_STATUSES: Record<string, BookingStatus[]> = {
  UPCOMING: ['PENDING', 'CONFIRMED'],
  IN_PROGRESS: ['IN_PROGRESS', 'PENDING_CHECKOUT'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
};

/**
 * Configuration des heures par défaut pour les réservations
 */
export const RESERVATION_TIMES = {
  CHECK_IN: '12:00',
  CHECK_OUT: '11:00',
};
