import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useInvoices } from '@/hooks/useInvoices';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueFilters } from '@/components/reports/RevenueFilters';
import { RevenueChart } from '@/components/reports/RevenueChart';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const RevenueReport = () => {
  const [filters, setFilters] = useState<{
    dateRange?: { from?: Date; to?: Date; };
    roomType: string;
  }>({
    dateRange: undefined,
    roomType: 'all',
  });

  // Fetch all necessary data
  const { data: invoicesResult, isLoading: invoicesLoading } = useInvoices({ pagination: { pageIndex: 0, pageSize: 9999 }});
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();

  const invoices = invoicesResult?.data || [];
  const bookings = bookingsResult?.data || [];
  
  const isLoading = invoicesLoading || bookingsLoading || roomsLoading;

  const revenueData = useMemo(() => {
    if (invoices.length === 0 || bookings.length === 0) {
      return { totalRevenue: 0, revenueByRoomType: [], revenueOverTime: [] };
    }

    // Create maps for efficient lookups
    const bookingsMap = new Map(bookings.map(b => [b.id, b]));
    const roomsMap = new Map(rooms.map(r => [r.id, r]));

    const filteredInvoices = invoices.filter(invoice => {
      // Date filter
      const invoiceDate = new Date(invoice.date);
      if (filters.dateRange?.from && filters.dateRange?.to) {
        if (!isWithinInterval(invoiceDate, { start: startOfDay(filters.dateRange.from), end: endOfDay(filters.dateRange.to) })) {
          return false;
        }
      }

      // Room type filter
      if (filters.roomType !== 'all') {
        const booking = bookingsMap.get(invoice.booking_id);
        if (!booking) return false;
        const room = roomsMap.get(booking.room_id);
        if (!room || room.type !== filters.roomType) {
          return false;
        }
      }
      return true;
    });

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.net_total || inv.total), 0);

    // Calculate revenue by room type
    const revenueByRoomType = filteredInvoices.reduce((acc, invoice) => {
      const booking = bookingsMap.get(invoice.booking_id);
      if (!booking) return acc;
      const room = roomsMap.get(booking.room_id);
      if (!room) return acc;

      const roomType = room.type;
      const amount = invoice.net_total || invoice.total;
      
      const existing = acc.find(item => item.roomType === roomType);
      if (existing) {
        existing.revenue += amount;
      } else {
        acc.push({ roomType, revenue: amount });
      }
      return acc;
    }, [] as { roomType: string; revenue: number }[]);

    // Calculate revenue over time (daily)
    const revenueOverTime = filteredInvoices.reduce((acc, invoice) => {
      const date = format(parseISO(invoice.date), 'yyyy-MM-dd');
      const amount = invoice.net_total || invoice.total;

      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.revenue += amount;
      } else {
        acc.push({ date, revenue: amount });
      }
      return acc;
    }, [] as { date: string; revenue: number }[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      totalRevenue,
      revenueByRoomType: revenueByRoomType.sort((a, b) => b.revenue - a.revenue),
      revenueOverTime,
    };
  }, [invoices, bookings, rooms, filters]);

  return (
    <MainLayout title="Rapport de Revenus Détaillé" subtitle="Analyse des revenus par différentes catégories">
      <div className="space-y-6">
        
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueFilters 
              rooms={rooms}
              onFilterChange={(newFilters) => setFilters(newFilters as any)} 
            />
          </CardContent>
        </Card>

        {/* Aggregate Stat */}
        <Card>
          <CardHeader>
            <CardTitle>Revenu Total Filtré</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              <CurrencyDisplay amountUSD={revenueData.totalRevenue} />
            </p>
          </CardContent>
        </Card>

        {/* Graphique */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance des revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Chargement des données du graphique...</p>
              </div>
            ) : (
              <RevenueChart data={revenueData.revenueOverTime} />
            )}
          </CardContent>
        </Card>

        {/* Tableau de données */}
        <Card>
          <CardHeader>
            <CardTitle>Revenus par type de chambre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type de Chambre</TableHead>
                    <TableHead className="text-right">Revenu Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={2} className="h-24 text-center">Chargement...</TableCell></TableRow>
                  ) : revenueData.revenueByRoomType.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="h-24 text-center">Aucune donnée de revenu trouvée pour les filtres sélectionnés.</TableCell></TableRow>
                  ) : (
                    revenueData.revenueByRoomType.map((item) => (
                      <TableRow key={item.roomType}>
                        <TableCell className="font-medium">{item.roomType}</TableCell>
                        <TableCell className="text-right">
                          <CurrencyDisplay amountUSD={item.revenue} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RevenueReport;
