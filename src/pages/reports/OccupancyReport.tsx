import { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { MainLayout } from '@/components/layout/MainLayout';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays, max, min, startOfDay, endOfDay, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Calendar as CalendarIcon, TrendingUp, BedDouble, Percent, Download, BarChart2, PieChart as PieChartIcon, Clock } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { exportOccupancyReportToCsv, exportOccupancyReportToPdf } from '@/services/financialReportExportService';

type Period = 'today' | 'week' | 'month';

const OccupancyReport = () => {
  const [period, setPeriod] = useState<string>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfToday(),
    to: endOfToday(),
  });

  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();

  const bookings = bookingsResult?.data || [];
  const isLoading = bookingsLoading || roomsLoading;

  const occupancyData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || rooms.length === 0) {
      return { occupancyRate: 0, totalNightsAvailable: 0, totalNightsOccupied: 0, occupancyByRoom: [] };
    }

    const periodStart = startOfDay(dateRange.from);
    const periodEnd = endOfDay(dateRange.to);
    const periodDays = differenceInCalendarDays(periodEnd, periodStart) + 1;

    const totalNightsAvailable = rooms.length * periodDays;
    const validBookings = bookings.filter(b => b.status !== 'CANCELLED');

    let totalNightsOccupied = 0;

    const occupancyByRoom = rooms.map(room => {
      let roomNightsOccupied = 0;
      const roomBookings = validBookings.filter(b => b.room_id === room.id);

      roomBookings.forEach(booking => {
        try {
          const bookingStart = new Date(booking.date_debut_prevue);
          const bookingEnd = new Date(booking.date_fin_prevue);
          const overlapStart = max([bookingStart, periodStart]);
          const overlapEnd = min([bookingEnd, periodEnd]);

          if (overlapStart < overlapEnd) {
            roomNightsOccupied += differenceInCalendarDays(overlapEnd, overlapStart);
          }
        } catch (e) { }
      });

      totalNightsOccupied += roomNightsOccupied;
      const roomOccupancyRate = periodDays > 0 ? (roomNightsOccupied / periodDays) * 100 : 0;

      return {
        ...room,
        nightsOccupied: roomNightsOccupied,
        occupancyRate: roomOccupancyRate,
      };
    });

    const occupancyRate = totalNightsAvailable > 0 ? (totalNightsOccupied / totalNightsAvailable) * 100 : 0;

    return {
      occupancyRate,
      totalNightsAvailable,
      totalNightsOccupied,
      occupancyByRoom: occupancyByRoom.sort((a, b) => b.occupancyRate - a.occupancyRate)
    };
  }, [bookings, rooms, dateRange]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const today = new Date();

    if (value === 'today') {
      setDateRange({ from: startOfToday(), to: endOfToday() });
    } else if (value === 'week') {
      setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
    } else if (value === 'month') {
      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
    }
  };

  // Données pour le graphique (Occupation par jour)
  const chartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const days: any[] = [];
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to);
    const totalDays = differenceInCalendarDays(end, start) + 1;

    for (let i = 0; i < totalDays; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      const dayStr = format(currentDay, 'yyyy-MM-dd');

      let occupiedCount = 0;
      bookings.filter(b => b.status !== 'CANCELLED').forEach(booking => {
        const bStart = startOfDay(new Date(booking.date_debut_prevue));
        const bEnd = endOfDay(new Date(booking.date_fin_prevue));
        if (isWithinInterval(currentDay, { start: bStart, end: bEnd })) {
          occupiedCount++;
        }
      });

      days.push({
        name: format(currentDay, 'dd/MM'),
        rate: rooms.length > 0 ? (occupiedCount / rooms.length) * 100 : 0,
        occupied: occupiedCount,
      });
    }
    return days;
  }, [bookings, rooms, dateRange]);

  return (
    <MainLayout title="Rapport d'Occupation" subtitle="Analyse détaillée de l'utilisation de vos chambres">
      <div className="space-y-6 animate-fade-in">

        {/* Filtres Premium */}
        <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-4 shadow-soft">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Période d'analyse
              </label>
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="bg-background">
                  <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                  <SelectValue placeholder="Choisir une période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois-ci</SelectItem>
                  <SelectItem value="custom">Plage personnalisée...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <div className="space-y-2 animate-in slide-in-from-left-2 duration-200">
                <label className="text-xs font-medium text-muted-foreground">Sélectionner la plage</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-background">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`) : format(dateRange.from, "dd/MM/yyyy")) : (<span>Plage personnalisée</span>)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => exportOccupancyReportToPdf(occupancyData.occupancyByRoom, dateRange, occupancyData)}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => exportOccupancyReportToCsv(occupancyData.occupancyByRoom, dateRange)}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title="Taux d'occupation"
            value={`${occupancyData.occupancyRate.toFixed(1)}%`}
            subtitle="Moyenne sur la période"
            icon={Percent}
            variant="primary"
          />
          <StatsCard
            title="Nuits Occupées"
            value={occupancyData.totalNightsOccupied.toString()}
            subtitle={`Sur ${occupancyData.totalNightsAvailable} nuits vendables`}
            icon={BedDouble}
          />
          <StatsCard
            title="Capacité Totale"
            value={rooms.length.toString()}
            subtitle="Chambres configurées"
            icon={TrendingUp}
          />
        </div>

        {/* Graphique de tendances */}
        <Card className="border-none shadow-medium overflow-hidden">
          <CardHeader className="bg-secondary/10 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Évolution de l'Occupation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [`${val.toFixed(1)}%`, 'Taux d\'occupation']}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tableau Détails */}
        <Card className="border-none shadow-medium">
          <CardHeader className="bg-secondary/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Répartition par Chambre
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/5">
                <TableRow>
                  <TableHead className="font-bold">CHAMBRE</TableHead>
                  <TableHead className="font-bold">TYPE</TableHead>
                  <TableHead className="font-bold text-center">NUITS</TableHead>
                  <TableHead className="font-bold">PERFORMANCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">Chargement...</TableCell></TableRow>
                ) : occupancyData.occupancyByRoom.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Aucune donnée pour cette période.</TableCell></TableRow>
                ) : (
                  occupancyData.occupancyByRoom.map((room) => (
                    <TableRow key={room.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-bold">{room.numero}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{room.type}</TableCell>
                      <TableCell className="text-center font-medium">{room.nightsOccupied}</TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <Progress value={room.occupancyRate} className="h-2 flex-1" />
                          <span className="text-xs font-bold w-12 text-right">{room.occupancyRate.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default OccupancyReport;
