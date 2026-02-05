import { MainLayout } from '@/components/layout/MainLayout';
import { Building2, DollarSign, Users, Calendar, TrendingUp, UserRound, AlertTriangle } from 'lucide-react';
import { useRooms } from '@/hooks/useRooms';
import { useBookings } from '@/hooks/useBookings';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useAllPayments } from '@/hooks/usePayments';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';
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
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { useLocations } from '@/hooks/useLocations';
import { getEffectiveRoomStatus } from '@/lib/statusUtils';

const Dashboard = () => {
  const { role, profile } = useAuth();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
  const bookings = bookingsResult?.data || [];
  const { data: payments = [], isLoading: paymentsLoading } = useAllPayments();
  const { data: exchangeRateData } = useExchangeRate();
  const { notifications } = useAppNotifications();
  const rate = exchangeRateData?.usd_to_cdf || 2800;
  const isMobile = useIsMobile();
  const { selectedLocationId } = useLocationFilter();
  const { data: locations } = useLocations();

  const overdueCount = notifications.filter(n => n.type === 'checkout_overdue').length;

  // Calcul des statuts effectifs (dynamiques)
  const roomsWithEffectiveStatus = useMemo(() => {
    return rooms.map(room => ({
      ...room,
      status: getEffectiveRoomStatus(room, bookings)
    }));
  }, [rooms, bookings]);

  // Calcul des indicateurs basés sur le statut effectif
  const availableRooms = roomsWithEffectiveStatus.filter(r => r.status === 'Libre' || r.status === 'Nettoyage').length;
  const occupiedRooms = roomsWithEffectiveStatus.filter(r => r.status === 'Occupé').length;
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
      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <StatsCard
          title="Chambres disponibles"
          value={availableRooms}
          subtitle={`${totalRooms > 0 ? `${Math.round((availableRooms / totalRooms) * 100)}%` : '0%'} du parc`}
          icon={Building2}
          variant="success"
        />
        <StatsCard
          title="Chambres occupées"
          value={occupiedRooms}
          subtitle={`+ ${bookedRooms} réservées`}
          icon={Building2}
          variant="primary"
        />
        <StatsCard
          title="Taux d'occupation"
          value={`${fillRate}%`}
          subtitle={`${monthlyBookings.length} locations ce mois`}
          icon={TrendingUp}
          variant="primary"
        />
        <StatsCard
          title="Retards libération"
          value={overdueCount}
          subtitle={overdueCount > 0 ? "Action requise immédiate" : "Aucun retard détecté"}
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

      {/* Today's Events - Responsive grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Today's Arrivals - Mobile Card View */}
        <div className="sm:hidden bg-card rounded-lg border border-border shadow-soft">
          <div className="p-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
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
                  <div key={booking.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">
                      {booking.tenants?.prenom} {booking.tenants?.nom}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Chambre: {booking.rooms?.numero}
                    </div>
                    {role === 'ADMIN' && (
                      <div className="text-sm font-medium mt-1">
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
        <div className="hidden sm:block bg-card rounded-lg border border-border p-4 sm:p-6 shadow-soft">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-2 sm:mb-4 flex items-center gap-2">
            <Users className="h-4 sm:h-5 w-4 sm:w-5" />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayArrivals.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="text-xs sm:text-sm">
                      {booking.tenants?.prenom} {booking.tenants?.nom}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{booking.rooms?.numero}</TableCell>
                    {role === 'ADMIN' && <TableCell className="text-xs sm:text-sm">${booking.prix_total}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <RecentActivity activities={recentActivities} />
      </div>
    </MainLayout>
  );
};

export default Dashboard;