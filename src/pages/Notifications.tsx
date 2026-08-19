import { MainLayout } from '@/components/layout/MainLayout';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { AlertTriangle, Clock, CheckCircle, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
  const { notifications, isLoading } = useAppNotifications();
  const navigate = useNavigate();

  const getNotificationStyle = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900 shadow-red-100/50';
      case 'warning':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900 shadow-orange-100/50';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 shadow-blue-100/50';
    }
  };

  const getNotificationIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-500 animate-bounce" />;
      case 'warning':
        return <Clock className="h-6 w-6 text-orange-500" />;
      default:
        return <Home className="h-6 w-6 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Notifications" subtitle="Analyse du système...">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse font-medium">Récupération des alertes en cours...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Centre de Notifications"
      subtitle={`${notifications.length} alerte${notifications.length > 1 ? 's' : ''} nécessitant votre attention`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed border-slate-300">
            <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Système au vert</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Toutes les chambres sont à jour et aucun départ n'est en retard.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`group relative overflow-hidden rounded-2xl border-2 p-6 ${getNotificationStyle(notification.severity)} animate-fade-in transition-all hover:scale-[1.01] hover:shadow-xl`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 p-3 bg-white rounded-xl shadow-sm group-hover:rotate-12 transition-transform">
                    {getNotificationIcon(notification.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={notification.severity === 'error' ? 'text-red-600 font-black' : 'font-bold'}>
                        {notification.title}
                      </span>
                      {notification.severity === 'error' && (
                        <span className="px-2 py-0.5 bg-red-600 text-[10px] text-white rounded-full font-bold animate-pulse uppercase">Urgent</span>
                      )}
                    </div>
                    <p className="text-slate-600 font-medium">{notification.description}</p>

                    <div className="flex items-center gap-4 mt-4 py-2 border-t border-black/5">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-full">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Logement</span>
                        <span className="text-xs font-black">{notification.roomNumber}</span>
                      </div>
                      {notification.tenantName && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-full">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Client</span>
                          <span className="text-xs font-black">{notification.tenantName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Button
                      className="rounded-full h-12 w-12 p-0 bg-white hover:bg-indigo-600 hover:text-white border-slate-200 shadow-sm transition-all group-hover:translate-x-1"
                      variant="outline"
                      onClick={() => navigate('/reservations')}
                    >
                      <ChevronRight className="h-6 w-6" />
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
