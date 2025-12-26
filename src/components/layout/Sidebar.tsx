import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  Calendar,
  Users,
  FileText,
  Settings,
  ClipboardList,
  Bell,
  BarChart3,
  LogOut,
  Home,
  PanelLeftClose,
  PanelRightClose,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { isToday, isTomorrow, isPast, parseISO, differenceInDays } from 'date-fns';
import { useSidebar } from '@/context/SidebarContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/useMediaQuery';

const getNavigation = (notificationCount: number, role: string | null) => {
  const items = [
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Réservation', href: '/reservations', icon: ClipboardList },
    { name: 'Factures', href: '/invoices', icon: FileText },
    { name: 'Appartements', href: '/rooms', icon: BedDouble },
    { name: 'Calendrier des locations', href: '/planning', icon: Calendar },
    { name: 'Disponibilité', href: '/availability', icon: BarChart3 },
    { name: 'Rapports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
    { name: 'Locataires', href: '/tenants', icon: Users },
    { name: 'Notifications', href: '/notifications', icon: Bell, badgeCount: notificationCount },
    { name: 'Réglages', href: '/settings', icon: Settings },
  ];

  return items.filter(item => !item.roles || (role && item.roles.includes(role)));
};

export function Sidebar() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { data: bookingsResult } = useBookings();
  const bookings = bookingsResult?.data || [];
  const { data: rooms = [] } = useRooms();
  const isMobile = useIsMobile();

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
      if (room.status === 'PENDING_CHECKOUT' || room.status === 'PENDING_CLEANING') {
        count++;
      }
    });
    return count;
  }, [bookings, rooms]);

  const navigation = useMemo(() => getNavigation(notificationCount, role), [notificationCount, role]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile ? `${profile.prenom} ${profile.nom}` : 'Utilisateur';

  // Cacher le sidebar sur mobile et n'afficher que sur desktop
  if (isMobile) {
    return null;
  }

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
      isCollapsed ? "w-20" : "w-60"
    )}>
      <div className="flex items-center justify-between gap-2 px-4 border-b border-border h-[69px]">
        <div className="flex items-center gap-2">
          <img
            src="/LOGO.jpg"
            alt="Botes Immo Logo"
            className="h-10 w-10 rounded-lg object-contain flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-primary text-base truncate">Botes Immo</h1>
              <p className="text-xs text-muted-foreground truncate">Gestion Immobilière</p>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          {isCollapsed ? <PanelRightClose className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                isCollapsed && "justify-center"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="flex-1">{item.name}</span>}
            {!isCollapsed && item.badgeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs px-1">
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-2">
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-3 text-muted-foreground hover:text-foreground",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Se déconnecter</span>}
        </Button>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {profile?.prenom?.charAt(0) || 'U'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}