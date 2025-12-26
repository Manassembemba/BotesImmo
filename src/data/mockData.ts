import { Room, Reservation, Tenant, CleaningTask, RoomStatus } from '@/types/room';

export const mockRooms: Room[] = [
  {
    id: '1',
    number: '101',
    type: 'SINGLE',
    capacity: 1,
    status: 'Libre',
    pricePerNight: 45,
    pricePerWeek: 280,
    pricePerMonth: 1000,
    equipment: ['WiFi', 'TV', 'Climatisation'],
    floor: 1,
  },
  {
    id: '2',
    number: '102',
    type: 'DOUBLE',
    capacity: 2,
    status: 'Occupé',
    pricePerNight: 65,
    pricePerWeek: 400,
    pricePerMonth: 1400,
    equipment: ['WiFi', 'TV', 'Climatisation', 'Mini-bar'],
    floor: 1,
  },
  {
    id: '3',
    number: '103',
    type: 'DOUBLE',
    capacity: 2,
    status: 'Occupé',
    pricePerNight: 65,
    pricePerWeek: 400,
    pricePerMonth: 1400,
    equipment: ['WiFi', 'TV', 'Climatisation'],
    floor: 1,
  },
  {
    id: '4',
    number: '201',
    type: 'SUITE',
    capacity: 4,
    status: 'Nettoyage',
    pricePerNight: 120,
    pricePerWeek: 750,
    pricePerMonth: 2800,
    equipment: ['WiFi', 'TV', 'Climatisation', 'Mini-bar', 'Balcon', 'Coffre-fort'],
    floor: 2,
  },
  {
    id: '5',
    number: '202',
    type: 'STUDIO',
    capacity: 2,
    status: 'Libre',
    pricePerNight: 85,
    pricePerWeek: 520,
    pricePerMonth: 1900,
    equipment: ['WiFi', 'TV', 'Climatisation', 'Kitchenette'],
    floor: 2,
  },
  {
    id: '6',
    number: '203',
    type: 'SINGLE',
    capacity: 1,
    status: 'Maintenance',
    pricePerNight: 45,
    pricePerWeek: 280,
    pricePerMonth: 1000,
    equipment: ['WiFi', 'TV'],
    floor: 2,
  },
  {
    id: '7',
    number: '301',
    type: 'SUITE',
    capacity: 4,
    status: 'Occupé',
    pricePerNight: 150,
    pricePerWeek: 900,
    pricePerMonth: 3200,
    equipment: ['WiFi', 'TV', 'Climatisation', 'Mini-bar', 'Balcon', 'Coffre-fort', 'Jacuzzi'],
    floor: 3,
  },
  {
    id: '8',
    number: '302',
    type: 'DOUBLE',
    capacity: 2,
    status: 'Libre',
    pricePerNight: 70,
    pricePerWeek: 430,
    pricePerMonth: 1500,
    equipment: ['WiFi', 'TV', 'Climatisation', 'Vue mer'],
    floor: 3,
  },
];

export const mockTenants: Tenant[] = [
  {
    id: '1',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@email.com',
    phone: '+33 6 12 34 56 78',
    idDocument: 'CNI-123456',
    isBlacklisted: false,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    firstName: 'Marie',
    lastName: 'Martin',
    email: 'marie.martin@email.com',
    phone: '+33 6 98 76 54 32',
    idDocument: 'PASSPORT-789012',
    isBlacklisted: false,
    createdAt: new Date('2024-02-20'),
  },
  {
    id: '3',
    firstName: 'Pierre',
    lastName: 'Bernard',
    email: 'pierre.bernard@email.com',
    phone: '+33 6 55 44 33 22',
    notes: 'Client régulier',
    isBlacklisted: false,
    createdAt: new Date('2023-11-05'),
  },
];

export const mockReservations: Reservation[] = [
  {
    id: '1',
    roomId: '2',
    tenantId: '1',
    checkIn: new Date('2025-12-01'),
    checkOut: new Date('2025-12-07'),
    status: 'CONFIRMED',
    totalAmount: 390,
    paidAmount: 390,
  },
  {
    id: '2',
    roomId: '3',
    tenantId: '2',
    checkIn: new Date('2025-11-28'),
    checkOut: new Date('2025-12-02'),
    status: 'CONFIRMED',
    totalAmount: 260,
    paidAmount: 130,
    notes: 'Paiement en 2 fois',
  },
  {
    id: '3',
    roomId: '7',
    tenantId: '3',
    checkIn: new Date('2025-11-25'),
    checkOut: new Date('2025-12-10'),
    status: 'CONFIRMED',
    totalAmount: 2250,
    paidAmount: 2250,
  },
  {
    id: '4',
    roomId: '1',
    tenantId: '1',
    checkIn: new Date('2025-12-10'),
    checkOut: new Date('2025-12-15'),
    status: 'PENDING',
    totalAmount: 225,
    paidAmount: 0,
  },
];

export const mockCleaningTasks: CleaningTask[] = [
  {
    id: '1',
    roomId: '4',
    assignedTo: 'Agent Nettoyage 1',
    status: 'PENDING',
    createdAt: new Date(),
    notes: 'Nettoyage complet après départ',
  },
];

export const getStatusLabel = (status: RoomStatus): string => {
  const labels: Record<RoomStatus, string> = {
    Libre: 'Disponible',
    Occupé: 'Occupée',
    Nettoyage: 'Nettoyage',
    Maintenance: 'En maintenance',
  };
  return labels[status];
};

export const getStatusColor = (status: RoomStatus): string => {
  const colors: Record<RoomStatus, string> = {
    Libre: 'status-available',
    Occupé: 'status-occupied',
    Nettoyage: 'status-pending-cleaning',
    Maintenance: 'status-out-of-service',
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
