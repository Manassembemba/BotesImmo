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
    label: 'En attente',
    className: 'status-badge bg-yellow-100 text-foreground dark:bg-yellow-900/30',
    bg: 'bg-yellow-500',
    text: 'text-black',
    light: 'bg-yellow-100',
    border: 'border-yellow-600',
    icon: 'border-yellow-500'
  },
  CONFIRMED: {
    label: 'Confirmé',
    className: 'status-badge bg-blue-100 text-foreground dark:bg-blue-900/30',
    bg: 'bg-blue-500',
    text: 'text-white',
    light: 'bg-blue-100',
    border: 'border-blue-600',
    icon: 'border-blue-500'
  },
  IN_PROGRESS: {
    label: 'En cours',
    className: 'status-badge bg-green-100 text-foreground dark:bg-green-900/30',
    bg: 'bg-green-600',
    text: 'text-white',
    light: 'bg-green-100',
    border: 'border-green-700',
    icon: 'border-green-600'
  },
  PENDING_CHECKOUT: {
    label: 'Départ en attente',
    className: 'status-badge bg-orange-100 text-foreground dark:bg-orange-900/30 animate-pulse',
    bg: 'bg-orange-500',
    text: 'text-black',
    light: 'bg-orange-100',
    border: 'border-orange-600',
    icon: 'border-orange-500'
  },
  COMPLETED: {
    label: 'Terminée',
    className: 'status-badge bg-gray-100 text-foreground dark:bg-gray-800',
    bg: 'bg-gray-600',
    text: 'text-white',
    light: 'bg-gray-100',
    border: 'border-gray-700',
    icon: 'border-gray-600'
  },
  CANCELLED: {
    label: 'Annulée',
    className: 'status-badge bg-red-100 text-foreground dark:bg-red-900/30',
    bg: 'bg-black',
    text: 'text-white',
    light: 'bg-gray-200',
    border: 'border-gray-800',
    icon: 'border-black'
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
  UPCOMING: STATUS_CONFIG.PENDING,
  IN_PROGRESS: STATUS_CONFIG.IN_PROGRESS,
  COMPLETED: STATUS_CONFIG.COMPLETED,
  CANCELLED: STATUS_CONFIG.CANCELLED,
};

/**
 * Configuration des styles pour les statuts physiques des chambres
 */
export const ROOM_STATUS_CONFIG: Record<string, { bg: string; tint: string }> = {
  Libre: { bg: 'bg-emerald-500', tint: 'bg-emerald-50/20' },
  Occupé: { bg: 'bg-blue-500', tint: 'bg-blue-50/30' },
  Maintenance: { bg: 'bg-slate-500', tint: 'bg-slate-50/30' },
  MAINTENANCE: { bg: 'bg-slate-500', tint: 'bg-slate-50/30' },
  PENDING_CHECKOUT: { bg: 'bg-amber-500', tint: 'bg-amber-50/30' },
  BOOKED: { bg: 'bg-indigo-400', tint: 'bg-indigo-50/20' },
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
