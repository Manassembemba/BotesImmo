import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useTasks } from '@/hooks/useTasks';
import { differenceInDays, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { useMemo } from 'react';

export interface NotificationItem {
    id: string;
    type: 'checkout_today' | 'checkout_tomorrow' | 'checkout_overdue' | 'pending_cleaning' | 'pending_checkout';
    title: string;
    description: string;
    date: Date;
    roomNumber: string;
    tenantName?: string;
    severity: 'warning' | 'error' | 'info';
}

export function useAppNotifications() {
    const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
    const bookings = bookingsResult?.data || [];
    const { data: rooms = [], isLoading: roomsLoading } = useRooms();
    const { data: tasks = [], isLoading: tasksLoading } = useTasks();

    const isLoading = bookingsLoading || roomsLoading || tasksLoading;

    const notifications = useMemo(() => {
        const items: NotificationItem[] = [];

        // Check bookings
        bookings.forEach(booking => {
            if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) return;

            const room = rooms.find(r => r.id === booking.room_id);
            if (!room) return;

            const endDate = parseISO(booking.date_fin_prevue);
            const today = new Date();
            const daysUntil = differenceInDays(endDate, today);
            const tenantName = booking.tenants ? `${booking.tenants.prenom} ${booking.tenants.nom}` : 'Client';

            if (isPast(endDate) && daysUntil < 0) {
                items.push({
                    id: `checkout-overdue-${booking.id}`,
                    type: 'checkout_overdue',
                    title: `RETARD : ${room.numero}`,
                    description: `${tenantName} devait libérer l'appartement`,
                    date: endDate,
                    roomNumber: room.numero,
                    tenantName,
                    severity: 'error'
                });
            } else if (isToday(endDate)) {
                items.push({
                    id: `checkout-today-${booking.id}`,
                    type: 'checkout_today',
                    title: `DÉPART AUJOURD'HUI : ${room.numero}`,
                    description: `Check-out prévu pour ${tenantName}`,
                    date: endDate,
                    roomNumber: room.numero,
                    tenantName,
                    severity: 'warning'
                });
            } else if (isTomorrow(endDate)) {
                items.push({
                    id: `checkout-tomorrow-${booking.id}`,
                    type: 'checkout_tomorrow',
                    title: `DÉPART DEMAIN : ${room.numero}`,
                    description: `${tenantName} libère l'appartement demain`,
                    date: endDate,
                    roomNumber: room.numero,
                    tenantName,
                    severity: 'info'
                });
            }
        });

        // Check rooms
        rooms.forEach(room => {
            if (room.status === 'PENDING_CHECKOUT') {
                items.push({
                    id: `pending-checkout-${room.id}`,
                    type: 'pending_checkout',
                    title: `LIBÉRATION : ${room.numero}`,
                    description: `Confirmation de départ en attente`,
                    date: new Date(),
                    roomNumber: room.numero,
                    severity: 'warning'
                });
            } else if (room.status === 'PENDING_CLEANING' || room.status === 'Nettoyage') {
                items.push({
                    id: `pending-cleaning-${room.id}`,
                    type: 'pending_cleaning',
                    title: `NETTOYAGE : ${room.numero}`,
                    description: `L'appartement doit être préparé`,
                    date: new Date(),
                    roomNumber: room.numero,
                    severity: 'info'
                });
            }
        });

        return items.sort((a, b) => {
            const severityOrder = { error: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }, [bookings, rooms, tasks]);

    return { notifications, isLoading };
}
