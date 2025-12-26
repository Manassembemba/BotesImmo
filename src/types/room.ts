export type RoomStatus = 'Libre' | 'Occupé' | 'Nettoyage' | 'Maintenance';
export type RoomType = 'SINGLE' | 'DOUBLE' | 'SUITE' | 'STUDIO';

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  capacity: number;
  status: RoomStatus;
  pricePerNight: number;
  pricePerWeek: number;
  pricePerMonth: number;
  equipment: string[];
  floor: number;
}

export interface Reservation {
  id: string;
  roomId: string;
  tenantId: string;
  checkIn: Date;
  checkOut: Date;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';
  totalAmount: number;
  paidAmount: number;
  notes?: string;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idDocument?: string;
  notes?: string;
  isBlacklisted: boolean;
  createdAt: Date;
}

export interface CleaningTask {
  id: string;
  roomId: string;
  assignedTo?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: Date;
  completedAt?: Date;
  notes?: string;
}

export interface Incident {
  id: string;
  roomId: string;
  reportedBy: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  photos?: string[];
  createdAt: Date;
  resolvedAt?: Date;
}
