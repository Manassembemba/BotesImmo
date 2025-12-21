import { MainLayout } from '@/components/layout/MainLayout';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useTasks } from '@/hooks/useTasks';
import { format, differenceInDays, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Clock, CheckCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface NotificationItem {
  id: string;
  type: 'checkout_today' | 'checkout_tomorrow' | 'checkout_overdue' | 'pending_cleaning' | 'pending_checkout';
  title: string;
  description: string;
  date: Date;
  roomNumber: string;
  tenantName?: string;
  severity: 'warning' | 'error' | 'info';
}

const Notifications = () => {
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const navigate = useNavigate();

  const isLoading = bookingsLoading || roomsLoading || tasksLoading;

  // Generate notifications
  const notifications: NotificationItem[] = [];

  // Check for checkout notifications from bookings
  bookings.forEach(booking => {
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) return;
    
    const room = rooms.find(r => r.id === booking.room_id);
    if (!room) return;

    const endDate = parseISO(booking.date_fin_prevue);
    const today = new Date();
    const daysUntil = differenceInDays(endDate, today);

    const tenantName = booking.tenants 
      ? `${booking.tenants.prenom} ${booking.tenants.nom}`
      : 'Client';

    if (isPast(endDate) && daysUntil < 0) {
      notifications.push({
        id: `checkout-overdue-${booking.id}`,
        type: 'checkout_overdue',
        title: `Départ en retard - ${room.numero}`,
        description: `${tenantName} devait partir le ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`,
        date: endDate,
        roomNumber: room.numero,
        tenantName,
        severity: 'error'
      });
    } else if (isToday(endDate)) {
      notifications.push({
        id: `checkout-today-${booking.id}`,
        type: 'checkout_today',
        title: `Départ aujourd'hui - ${room.numero}`,
        description: `${tenantName} doit partir aujourd'hui`,
        date: endDate,
        roomNumber: room.numero,
        tenantName,
        severity: 'warning'
      });
    } else if (isTomorrow(endDate)) {
      notifications.push({
        id: `checkout-tomorrow-${booking.id}`,
        type: 'checkout_tomorrow',
        title: `Départ demain - ${room.numero}`,
        description: `${tenantName} part demain ${format(endDate, 'dd/MM', { locale: fr })}`,
        date: endDate,
        roomNumber: room.numero,
        tenantName,
        severity: 'info'
      });
    }
  });

  // Check for rooms pending checkout or cleaning
  rooms.forEach(room => {
    if (room.status === 'PENDING_CHECKOUT') {
      notifications.push({
        id: `pending-checkout-${room.id}`,
        type: 'pending_checkout',
        title: `En attente de départ - ${room.numero}`,
        description: `L'appartement ${room.numero} attend la confirmation du départ`,
        date: new Date(),
        roomNumber: room.numero,
        severity: 'warning'
      });
    } else if (room.status === 'PENDING_CLEANING') {
      notifications.push({
        id: `pending-cleaning-${room.id}`,
        type: 'pending_cleaning',
        title: `Nettoyage requis - ${room.numero}`,
        description: `L'appartement ${room.numero} doit être nettoyé`,
        date: new Date(),
        roomNumber: room.numero,
        severity: 'info'
      });
    }
  });

  // Sort notifications by severity (error first) then by date
  notifications.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.date.getTime() - b.date.getTime();
  });

  const getNotificationStyle = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900';
      case 'warning':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900';
    }
  };

  const getNotificationIcon = (type: string, severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <Clock className="h-5 w-5 text-orange-500" />;
      default:
        return <Home className="h-5 w-5 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Notifications" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Notifications" subtitle={`${notifications.length} notification${notifications.length > 1 ? 's' : ''} active${notifications.length > 1 ? 's' : ''}`}>
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Aucune notification</p>
            <p className="text-sm text-muted-foreground">Tout est en ordre pour le moment</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`rounded-xl border p-5 ${getNotificationStyle(notification.severity)} animate-fade-in transition-all hover:shadow-md`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type, notification.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-muted-foreground">
                        Appartement: <span className="font-medium">{notification.roomNumber}</span>
                      </span>
                      {notification.tenantName && (
                        <span className="text-xs text-muted-foreground">
                          Client: <span className="font-medium">{notification.tenantName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/reservations')}
                    >
                      Voir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Notifications;
