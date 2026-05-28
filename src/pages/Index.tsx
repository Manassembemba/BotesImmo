import { MainLayout } from '@/components/layout/MainLayout';
import { Building2, DollarSign, Users, Calendar, TrendingUp, UserRound, AlertTriangle } from 'lucide-react';
import { useRooms } from '@/hooks/useRooms';
import { useBookings } from '@/hooks/useBookings';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useAllPayments } from '@/hooks/usePayments';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useAuth } from '@/hooks/useAuth';
import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart
} from 'recharts';
import { format, isToday, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RoomStatusOverview } from '@/components/dashboard/RoomStatusOverview';
import { PendingCheckouts } from '@/components/dashboard/PendingCheckouts';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { CheckInDialog } from '@/components/bookings/CheckInDialog';
import { CheckoutDecisionDialog } from '@/components/checkout/CheckoutDecisionDialog';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { useLocations } from '@/hooks/useLocations';
import { getEffectiveRoomStatus } from '@/lib/statusUtils';
import { Button } from '@/components/ui/button';
import { LogIn, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Booking } from '@/hooks/useBookings';
import { Room } from '@/hooks/useRooms';

const Dashboard = () => {
  const { role, profile } = useAuth();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings({}, { pageIndex: 0, pageSize: 2000 });
  const bookings = bookingsResult?.data || [];
  const { data: payments = [], isLoading: paymentsLoading } = useAllPayments();
  const { data: exchangeRateData } = useExchangeRate();
  const { notifications } = useAppNotifications();
  const rate = exchangeRateData?.usd_to_cdf || 2800;
  const isMobile = useIsMobile();
  const { selectedLocationId } = useLocationFilter();
  const { data: locations } = useLocations();

  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);

  const getRoomForBooking = (booking: Booking) => {
    return rooms.find(r => r.id === booking.room_id);
  };

  const overdueCount = notifications.filter(n => n.type === 'checkout_overdue').length;

  // Calcul des statuts effectifs (dynamiques)
  const roomsWithEffectiveStatus = useMemo(() => {
    const today = new Date();
    return rooms.map(room => {
      try {
        const { status: effectiveStatus } = getEffectiveRoomStatus(room, bookings, today);
        return {
          ...room,
          status: effectiveStatus
        };
      } catch (error) {
        console.error('Error calculating effective room status:', error);
        return {
          ...room,
          status: room.status // fallback to original status
        };
      }
    });
  }, [rooms, bookings]);

  // Calcul des indicateurs basés sur le statut effectif
  const freeRooms = roomsWithEffectiveStatus.filter(r => 
    r.status === 'Libre' || 
    r.status === 'Nettoyage' || 
    r.status === 'A_NETTOYER' || 
    r.status === 'PENDING_CLEANING'
  ).length;
  const occupiedRooms = roomsWithEffectiveStatus.filter(r => 
    r.status === 'Occupé' || 
    r.status === 'Maintenance' || 
    r.status === 'MAINTENANCE' ||
    r.status === 'PENDING_CHECKOUT'
  ).length;
  const bookedRooms = roomsWithEffectiveStatus.filter(r => r.status === 'BOOKED').length;
  const totalRooms = roomsWithEffectiveStatus.length;

  // Calcul des arrivées et départs du jour
  const todayArrivals = bookings.filter(b => isToday(new Date(b.date_debut_prevue)) && b.status !== 'CANCELLED');
  const todayDepartures = bookings.filter(b => isToday(new Date(b.date_fin_prevue)) && b.status !== 'CANCELLED');

  // Calcul des revenus réels perçus (basés sur les paiements)
  const actualPayments = payments.filter(p => {
    const paymentDate = new Date(p.date_paiement);
    return isToday(paymentDate);
  });
  const todayRevenueUsd = actualPayments.reduce((sum, p) => sum + (p.montant_usd || 0), 0);
  const todayRevenueCdf = actualPayments.reduce((sum, p) => sum + (p.montant_cdf || 0), 0);

  // Calcul des revenus par mois
  const monthlyData = useMemo(() => {
    const today = new Date();
    const startDate = subMonths(today, 13); // 14 derniers mois

    return eachMonthOfInterval({ start: startDate, end: today }).map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const monthBookings = bookings.filter(b =>
        format(parseISO(b.date_debut_prevue), 'yyyy-MM') === monthStr && b.status !== 'CANCELLED'
      );

      const monthPayments = payments.filter(p =>
        format(parseISO(p.date_paiement), 'yyyy-MM') === monthStr
      );

      return {
        month: format(month, 'MMM yyyy'),
        bookings: monthBookings.length,
        revenue: monthPayments.reduce((sum, p) => sum + p.montant, 0),
        occupancy: totalRooms > 0 ? Math.round((monthBookings.length / totalRooms) * 100) : 0
      };
    });
  }, [bookings, payments, totalRooms]);

  // Calcul des indicateurs KPI
  const fillRate = totalRooms > 0 ? Math.round(((occupiedRooms + bookedRooms) / totalRooms) * 100) : 0;
  const avgRevenuePerRoom = totalRooms > 0 ? Math.round((actualPayments.reduce((sum, p) => sum + p.montant, 0) / totalRooms) * 100) / 100 : 0;

  // Calcul des revenus mensuels
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyBookings = bookings.filter(b =>
    format(parseISO(b.date_debut_prevue), 'yyyy-MM') === currentMonth && b.status !== 'CANCELLED'
  );
  const monthlyRevenue = payments
    .filter(p => format(parseISO(p.date_paiement), 'yyyy-MM') === currentMonth)
    .reduce((sum, p) => sum + p.montant, 0);

  const recentActivities = useMemo(() => {
    const bookingActivities = bookings.slice(0, 10).map(b => ({
      id: `booking-${b.id}`,
      type: 'booking' as const,
      message: `Réservation: ${b.tenants?.prenom || ''} ${b.tenants?.nom || ''} (Ch. ${b.rooms?.numero || 'N/A'})`,
      timestamp: b.created_at,
    }));

    const paymentActivities = payments.slice(0, 10).map(p => ({
      id: `payment-${p.id}`,
      type: 'payment' as const,
      message: `Paiement reçu: ${formatCurrency(p.montant, rate).usd}`,
      timestamp: p.created_at,
    }));

    return [...bookingActivities, ...paymentActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [bookings, payments, rate]);

  const dashboardSubtitle = useMemo(() => {
    if (role === 'ADMIN') {
      if (selectedLocationId && locations) {
        const locationName = locations.find(l => l.id === selectedLocationId)?.nom;
        return `Données pour la localité : ${locationName || 'Inconnue'}`;
      }
      return "Vue d'ensemble de toutes les localités. Sélectionnez un site pour filtrer.";
    }
    if (profile?.locations?.nom) {
      return `Données pour la localité : ${profile.locations.nom}`;
    }
    if (profile?.location_id && locations) {
      const userLocation = locations.find(l => l.id === profile.location_id)?.nom;
      return `Données pour la localité : ${userLocation || 'Inconnue'}`;
    }
    return "Gérez efficacement votre établissement.";
  }, [role, profile, selectedLocationId, locations]);

  if (roomsLoading || bookingsLoading || paymentsLoading) {
    return (
      <MainLayout
        title="DASHBOARD"
        subtitle={dashboardSubtitle}
        headerImage
      >
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des données...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="DASHBOARD"
      subtitle={dashboardSubtitle}
      headerImage
    >
      <div className="flex items-center justify-between mb-4 bg-muted/30 px-4 py-2 rounded-lg border border-border/50">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <RefreshCw className="h-3 w-3 animate-spin-slow text-primary" />
          Synchronisation active (Auto: 15m)
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground italic">
          Mise à jour: {format(new Date(), 'HH:mm', { locale: fr })}
        </div>
      </div>

      {/* KPI Cards - 2x2 on mobile */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <StatsCard
          title="Libres"
          value={freeRooms}
          subtitle={`${totalRooms > 0 ? `${Math.round((freeRooms / totalRooms) * 100)}%` : '0%'}`}
          icon={Building2}
          variant="success"
        />
        <StatsCard
          title="Occupées"
          value={occupiedRooms}
          subtitle={`+ ${bookedRooms} rés.`}
          icon={Building2}
          variant="primary"
        />
        <StatsCard
          title="Taux"
          value={`${fillRate}%`}
          subtitle={`${monthlyBookings.length} loc.`}
          icon={TrendingUp}
          variant="primary"
        />
        <StatsCard
          title="Retards"
          value={overdueCount}
          subtitle={overdueCount > 0 ? "Action !" : "OK"}
          icon={AlertTriangle}
          variant={overdueCount > 0 ? "destructive" : "default"}
          className={cn(overdueCount > 0 && "animate-pulse shadow-md shadow-red-200")}
        />
      </div>

      {/* Additional KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 sm:mb-8">
        {/* Revenus du jour */}
        {role === 'ADMIN' && (
          <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
            <div className={cn("text-xs sm:text-sm text-muted-foreground mb-1")}>Revenus aujourd'hui</div>
            <div className="flex flex-col gap-1">
              <div className={cn("font-bold text-foreground", "text-lg sm:text-xl")}>{todayRevenueUsd.toFixed(2)} $</div>
              <div className="text-sm text-muted-foreground">{todayRevenueCdf.toLocaleString('fr-FR')} FC</div>
            </div>
          </div>
        )}

        {/* Revenu moyen par chambre */}
        {role === 'ADMIN' && (
          <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
            <div className={cn("text-xs sm:text-sm text-muted-foreground mb-1")}>Revenu/chambre/mois</div>
            <div className={cn("font-bold text-foreground", "text-xl sm:text-2xl")}>{formatCurrency(avgRevenuePerRoom, rate).usd}</div>
            <div className="text-xs text-muted-foreground">Moyenne du mois</div>
          </div>
        )}

        {/* Arrivées du jour */}
        <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
          <div className={cn("text-xs sm:text-sm text-muted-foreground mb-1")}>Arrivées aujourd'hui</div>
          <div className={cn("font-bold text-foreground", "text-xl sm:text-2xl")}>{todayArrivals.length}</div>
          <div className="text-xs text-muted-foreground">Prévu pour aujourd'hui</div>
        </div>

        {/* Départs du jour */}
        <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
          <div className={cn("text-xs sm:text-sm text-muted-foreground mb-1")}>Départs aujourd'hui</div>
          <div className={cn("font-bold text-foreground", "text-xl sm:text-2xl")}>{todayDepartures.length}</div>
          <div className="text-xs text-muted-foreground">À libérer aujourd'hui</div>
        </div>
      </div>

      {/* Today's Events - Priority View */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 mb-6 sm:mb-8">
        {/* Today's Arrivals - Mobile Card View */}
        <div className="sm:hidden bg-card rounded-lg border border-border shadow-soft animate-fade-in">
          <div className="p-4 border-b border-border bg-muted/20">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Arrivées du jour
            </h2>
          </div>
          <div className="p-4">
            {todayArrivals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Aucune arrivée prévue aujourd'hui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayArrivals.map((booking) => (
                  <div key={booking.id} className="border rounded-lg p-3 relative bg-card shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-sm">
                          {booking.tenants?.prenom} {booking.tenants?.nom}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          App. {booking.rooms?.numero} ({booking.rooms?.type})
                        </div>
                        <div className="text-[9px] text-muted-foreground italic mt-1">
                          Enregistré le {format(new Date(booking.created_at), 'dd/MM/yyyy')}
                        </div>
                      </div>
                      {!booking.check_in_reel ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200"
                          onClick={() => setCheckInBooking(booking)}
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    {role === 'ADMIN' && (
                      <div className="text-xs font-bold text-emerald-600">
                        ${booking.prix_total}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's Arrivals - Desktop Table View */}
        <div className="hidden sm:block bg-card rounded-lg border border-border p-4 sm:p-6 shadow-soft animate-fade-in">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-2 sm:mb-4 flex items-center gap-2">
            <Users className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
            Arrivées du jour
          </h2>
          {todayArrivals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Aucune arrivée prévue aujourd'hui</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-xs font-semibold">LOCATAIRE</TableHead>
                  <TableHead className="text-xs sm:text-xs font-semibold">CHAMBRE</TableHead>
                  {role === 'ADMIN' && <TableHead className="text-xs sm:text-xs font-semibold">PRIX (USD)</TableHead>}
                  <TableHead className="text-xs sm:text-xs font-semibold text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayArrivals.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs sm:text-sm">
                      <div className="font-medium">{booking.tenants?.prenom} {booking.tenants?.nom}</div>
                      <div className="text-[10px] text-muted-foreground flex flex-col">
                        <span>{booking.tenants?.telephone || 'Pas de tel.'}</span>
                        <span className="mt-1 italic">Enregistré le {format(new Date(booking.created_at), 'dd/MM/yyyy')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      <div className="font-bold">App. {booking.rooms?.numero}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{booking.rooms?.type}</div>
                    </TableCell>
                    {role === 'ADMIN' && <TableCell className="text-xs sm:text-sm font-medium text-emerald-600">${booking.prix_total}</TableCell>}
                    <TableCell className="text-right">
                      {!booking.check_in_reel ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 gap-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800"
                          onClick={() => setCheckInBooking(booking)}
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          Check-in
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-1 text-emerald-600 text-[10px] font-bold uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          Arrivé
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <RecentActivity activities={recentActivities} />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 mb-6 sm:mb-8">
        {/* Monthly Chart with Real Data */}
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6 shadow-soft">
          <h2 className={cn("font-bold text-foreground mb-2 sm:mb-4", "text-base sm:text-lg")}>Activité par mois</h2>
          <div className={cn("h-60 sm:h-80")}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: isMobile ? 9 : 11,
                    fill: 'hsl(var(--muted-foreground))'
                  }}
                  angle={isMobile ? -60 : -45}
                  textAnchor={isMobile ? "end" : "end"}
                  height={isMobile ? 100 : 80}
                />
                <YAxis yAxisId="left"
                  tick={{
                    fontSize: isMobile ? 9 : 11,
                    fill: 'hsl(var(--muted-foreground))'
                  }}
                  orientation="left"
                />
                <YAxis yAxisId="right"
                  tick={{
                    fontSize: isMobile ? 9 : 11,
                    fill: 'hsl(var(--muted-foreground))'
                  }}
                  orientation="right"
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'revenue') return [`${value}$`, 'Revenus (USD)'];
                    if (name === 'bookings') return [value, 'Nombre de locations'];
                    if (name === 'occupancy') return [`${value}%`, 'Taux d\'occupation'];
                    return [value, name];
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '14px'
                  }}
                />
                <Legend />
                <Bar yAxisId="right" dataKey="bookings" name="Nombre de locations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                {role === 'ADMIN' && <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenus (USD)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <RoomStatusOverview rooms={roomsWithEffectiveStatus} />
      </div>

      {/* Pending Checkouts */}
      <div className="mb-6 sm:mb-8">
        <PendingCheckouts rooms={rooms} bookings={bookings} />
      </div>

      {checkInBooking && (
        <CheckInDialog 
          booking={checkInBooking} 
          open={!!checkInBooking} 
          onOpenChange={(open) => !open && setCheckInBooking(null)} 
        />
      )}
      
      {checkOutBooking && getRoomForBooking(checkOutBooking) && (
        <CheckoutDecisionDialog 
          booking={checkOutBooking} 
          room={getRoomForBooking(checkOutBooking)!} 
          open={!!checkOutBooking} 
          onOpenChange={(open) => !open && setCheckOutBooking(null)} 
        />
      )}
    </MainLayout>
  );
};

export default Dashboard;