import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, BedDouble, Calendar, Users, FileText, Settings, ClipboardList, Bell, BarChart3, MoreHorizontal, MoreVertical, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { isToday, isTomorrow, isPast, parseISO, differenceInDays } from 'date-fns';
import { useMemo, useState } from 'react';

const navItems = [
  { name: 'Accueil', href: '/', icon: Home },
  { name: 'Réservations', href: '/reservations', icon: ClipboardList },
  { name: 'Appartements', href: '/rooms', icon: BedDouble },
  { name: 'Calendrier', href: '/planning', icon: Calendar },
  { name: 'Locataires', href: '/tenants', icon: Users },
  { name: 'Factures', href: '/invoices', icon: FileText },
  { name: 'Rapports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Réglages', href: '/settings', icon: Settings },
];

export function MobileNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut } = useAuth();
  const { data: bookingsResult } = useBookings();
  const bookings = bookingsResult?.data || [];
  const { data: rooms = [] } = useRooms();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Calculer le nombre de notifications
  const notificationCount = useMemo(() => {
    let count = 0;
    const today = new Date();
    bookings.forEach(booking => {
      if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) return;
      const endDate = parseISO(booking.date_fin_prevue);
      if (isPast(endDate) && differenceInDays(today, endDate) > 0) count++;
      else if (isToday(endDate)) count++;
      else if (isTomorrow(endDate)) count++;
    });
    rooms.forEach(room => {
      if (room.status === 'PENDING_CHECKOUT' || room.status === 'PENDING_CLEANING' || room.status === 'Nettoyage') {
        count++;
      }
    });
    return count;
  }, [bookings, rooms]);

  // Filtrer les éléments en fonction du rôle
  const filteredNavItems = navItems.filter(item => !item.roles || (role && item.roles.includes(role)));

  // Icons pour chaque page
  const getIcon = (href: string) => {
    switch (href) {
      case '/': return Home;
      case '/reservations': return ClipboardList;
      case '/rooms': return BedDouble;
      case '/planning': return Calendar;
      case '/tenants': return Users;
      case '/invoices': return FileText;
      case '/reports': return BarChart3;
      case '/notifications': return Bell;
      case '/settings': return Settings;
      default: return Home;
    }
  };

  // Diviser les éléments : 4 principaux + 1 pour "Plus" si nécessaire
  const mainNavItems = filteredNavItems.length > 4 ? filteredNavItems.slice(0, 4) : filteredNavItems;
  const extraNavItems = filteredNavItems.length > 4 ? filteredNavItems.slice(4) : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 md:hidden">
      <div className="grid grid-cols-5">
        {mainNavItems.map((item) => {
          const Icon = getIcon(item.href);
          const isActive = location.pathname === item.href;

          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex flex-col items-center justify-center py-3 relative",
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn("h-6 w-6", isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-xs mt-1">{item.name}</span>
              {item.href === '/notifications' && notificationCount > 0 && (
                <span className="absolute -top-1 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Bouton "Plus" avec menu déroulant si des éléments supplémentaires existent */}
        {extraNavItems.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={cn(
                "flex flex-col items-center justify-center py-3 relative",
                showMoreMenu ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <MoreVertical className="h-6 w-6" />
              <span className="text-xs mt-1">Plus</span>
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* Menu déroulant pour les éléments supplémentaires */}
            {showMoreMenu && (
              <div className="absolute bottom-16 right-2 left-auto bg-popover border border-border rounded-lg shadow-lg py-2 w-48 z-50">
                {extraNavItems.map((item, index) => {
                  const Icon = getIcon(item.href);
                  const isActive = location.pathname === item.href;

                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        navigate(item.href);
                        setShowMoreMenu(false); // Fermer le menu après avoir cliqué
                      }}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-secondary rounded-none first:rounded-t-md",
                        index === extraNavItems.length - 1 ? 'last:rounded-b-md border-b border-border' : '',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
                {/* Bouton de déconnexion */}
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/auth');
                    setShowMoreMenu(false); // Fermer le menu après déconnexion
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-secondary text-red-600 rounded-none last:rounded-b-md"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            )}

            {/* Overlay pour fermer le menu quand on clique ailleurs */}
            {showMoreMenu && (
              <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                onClick={() => setShowMoreMenu(false)}
              ></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}