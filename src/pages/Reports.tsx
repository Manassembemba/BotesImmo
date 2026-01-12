import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Download, FileText, TrendingUp, DollarSign, BedDouble, Calendar as CalendarIcon, Wallet, Hash, Loader2, Scale, Calculator, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfToday, startOfWeek, startOfMonth, endOfToday, endOfWeek, endOfMonth, isWithinInterval, parseISO, differenceInCalendarDays, max, min } from 'date-fns';
import { useAllPayments } from '@/hooks/usePayments';
import { useBookings } from '@/hooks/useBookings'; // Import useBookings
import { useRooms } from '@/hooks/useRooms'; // Import useRooms
import { useInvoices } from '@/hooks/useInvoices'; // Import useInvoices
import { StatsCard } from '@/components/dashboard/StatsCard';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { RevenueChart } from '@/components/reports/RevenueChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';


type Period = 'today' | 'week' | 'month' | 'custom';

const Reports = () => {
  const { role, profile } = useAuth(); // Get role and profile for location info
  const [period, setPeriod] = useState<Period>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfToday(),
    to: endOfToday(),
  });
  const [isExporting, setIsExporting] = useState(false);

  // --- DATA FETCHING ---
  const { data: payments = [], isLoading: paymentsLoading } = useAllPayments();
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings();
  const bookings = bookingsResult?.data || [];
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: invoicesResult, isLoading: invoicesLoading } = useInvoices({ pagination: { pageIndex: 0, pageSize: 9999 } });
  const invoices = invoicesResult?.data || [];
  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !rooms || rooms.length === 0) {
      return { totalRevenue: 0, numberOfPayments: 0, averagePayment: 0, totalUsdDirect: 0, totalCdfDirect: 0, occupancyRate: 0, totalNightsOccupied: 0, chartData: [], trends: { revenue: 0, occupancy: 0 } };
    }

    const periodStart = dateRange.from;
    const periodEnd = dateRange.to;
    const duration = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - duration);
    const previousPeriodEnd = new Date(periodEnd);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - duration);

    // Current period stats
    const filteredPayments = payments.filter(p => {
      try {
        const d = parseISO(p.date_paiement);
        return d >= periodStart && d <= periodEnd;
      } catch (error) { return false; }
    });
    const totalRevenue = filteredPayments.reduce((acc, p) => acc + p.montant, 0);
    const totalUsdDirect = filteredPayments.reduce((acc, p) => acc + (p.montant_usd || 0), 0);
    const totalCdfDirect = filteredPayments.reduce((acc, p) => acc + (p.montant_cdf || 0), 0);
    const numberOfPayments = filteredPayments.length;
    const averagePayment = numberOfPayments > 0 ? totalRevenue / numberOfPayments : 0;

    // Previous period stats for trends
    const previousPayments = payments.filter(p => {
      try {
        const d = parseISO(p.date_paiement);
        return d >= previousPeriodStart && d <= previousPeriodEnd;
      } catch (error) { return false; }
    });
    const previousRevenue = previousPayments.reduce((acc, p) => acc + p.montant, 0);
    const revenueTrend = previousRevenue > 0 ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100) : 0;

    // Chart Data (Group by day)
    const chartDataMap = new Map();
    filteredPayments.forEach(p => {
      const day = format(parseISO(p.date_paiement), 'yyyy-MM-dd');
      chartDataMap.set(day, (chartDataMap.get(day) || 0) + p.montant);
    });
    const chartData = Array.from(chartDataMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Occupancy stats
    const periodDays = duration;
    const totalNightsAvailable = rooms.length * periodDays;
    let totalNightsOccupied = 0;
    bookings.filter(b => b.status !== 'CANCELLED').forEach(booking => {
      try {
        const bStart = parseISO(booking.date_debut_prevue);
        const bEnd = parseISO(booking.date_fin_prevue);
        const overlapStart = max([bStart, periodStart]);
        const overlapEnd = min([bEnd, periodEnd]);
        if (overlapStart < overlapEnd) totalNightsOccupied += differenceInCalendarDays(overlapEnd, overlapStart);
      } catch (e) { }
    });
    const occupancyRate = totalNightsAvailable > 0 ? (totalNightsOccupied / totalNightsAvailable) * 100 : 0;

    return { totalRevenue, numberOfPayments, averagePayment, totalUsdDirect, totalCdfDirect, occupancyRate, totalNightsOccupied, chartData, trends: { revenue: revenueTrend } };
  }, [payments, bookings, rooms, dateRange]);

  const subtitle = useMemo(() => {
    if (role === 'ADMIN') {
      return "Analyses et exports de données globales.";
    }
    if (profile?.locations?.nom) {
      return `Analyses et exports pour la localité : ${profile.locations.nom}`;
    }
    return "Analyses et exports de données.";
  }, [role, profile]);

  // --- HANDLERS ---
  const handlePeriodChange = (selectedPeriod: Period) => {
    // ... (logique existante)
  };

  const handleFinancialReportCsvExport = () => {
    setIsExporting(true);

    // Créer des maps pour des recherches rapides
    const bookingsMap = new Map(bookings.map(b => [b.id, b]));
    const invoicesMap = new Map(invoices.map(i => [i.id, i]));

    // Définir les en-têtes du CSV
    const headers = [
      "ID Paiement", "Date", "Montant Total (USD)", "Montant USD Encaissé", "Montant CDF Encaissé",
      "Taux de Change", "Méthode", "Numéro Facture", "Client", "Chambre", "ID Réservation"
    ];

    const csvRows = [headers.join(',')];

    // Générer les lignes du CSV
    payments.forEach(p => {
      const booking = bookingsMap.get(p.booking_id);
      const invoice = p.invoice_id ? invoicesMap.get(p.invoice_id) : null;

      const row = [
        p.id,
        format(parseISO(p.date_paiement), 'yyyy-MM-dd HH:mm:ss'),
        p.montant.toFixed(2),
        (p.montant_usd || 0).toFixed(2),
        (p.montant_cdf || 0).toFixed(2),
        (p.taux_change || rate).toFixed(2),
        p.methode,
        invoice?.invoice_number || 'N/A',
        booking?.tenants ? `"${booking.tenants.prenom} ${booking.tenants.nom}"` : 'N/A',
        booking?.rooms?.numero || 'N/A',
        p.booking_id
      ];
      csvRows.push(row.join(','));
    });

    // Créer le Blob et déclencher le téléchargement
    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_financier_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExporting(false);
  };

  const reports = [
    {
      title: 'Rapport financier complet',
      description: 'Export de toutes les transactions financières et paiements.',
      icon: FileText,
      color: 'text-blue-500',
      path: '/reports/financial-report',
    },
    {
      title: "Rapport sur le taux d'occupation",
      description: "Statistiques et graphiques sur l'occupation des chambres.",
      icon: BedDouble,
      color: 'text-orange-500',
      path: '/reports/occupancy',
    },
    {
      title: 'Grand Livre',
      description: 'Vue détaillée de toutes les transactions comptables.',
      icon: FileText,
      color: 'text-indigo-500',
      path: '/reports/general-ledger',
    }
  ];

  const isLoading = paymentsLoading || bookingsLoading || invoicesLoading || roomsLoading;

  return (
    <MainLayout title="Rapports" subtitle={subtitle}>
      {/* ... (UI des filtres) ... */}

      {/* Cartes de Statistiques */}
      <div className="mb-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="h-28 bg-card rounded-lg border animate-pulse"></div>
            <div className="h-28 bg-card rounded-lg border animate-pulse"></div>
            <div className="h-28 bg-card rounded-lg border animate-pulse"></div>
            <div className="h-28 bg-card rounded-lg border animate-pulse"></div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <StatsCard
              title="Revenus Totaux"
              value={formatCurrency(stats.totalRevenue, rate).usd}
              subtitle={`${stats.totalUsdDirect.toLocaleString()}$ + ${stats.totalCdfDirect.toLocaleString()} FC`}
              icon={DollarSign}
              variant="success"
              trend={{ value: Math.abs(stats.trends.revenue), isPositive: stats.trends.revenue >= 0 }}
            />
            <StatsCard
              title="Taux d'occupation"
              value={`${stats.occupancyRate.toFixed(1)}%`}
              subtitle={`${stats.totalNightsOccupied} nuits réservées`}
              icon={TrendingUp}
              variant="primary"
            />
            <StatsCard
              title="Nombre de Paiements"
              value={stats.numberOfPayments.toString()}
              subtitle="transactions enregistrées"
              icon={Wallet}
            />
            <StatsCard
              title="Paiement Moyen"
              value={formatCurrency(stats.averagePayment, rate).usd}
              subtitle="par transaction"
              icon={Hash}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="md:col-span-3 overflow-hidden border-none shadow-medium bg-gradient-to-br from-card to-secondary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-bold">Évolution des Revenus</CardTitle>
              <p className="text-sm text-muted-foreground">Revenus journaliers cumulés pour la période</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="pt-4">
            <RevenueChart data={stats.chartData} />
          </CardContent>
        </Card>

        <Card className="border-none shadow-medium bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Intelligence Botes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-background/50 border border-indigo-100">
                <p className="text-sm font-medium text-foreground">Performance Revenus</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.trends.revenue >= 0
                    ? `Félicitations ! Vos revenus sont en hausse de ${stats.trends.revenue}% par rapport à la période précédente.`
                    : `Attention, vos revenus ont baissé de ${Math.abs(stats.trends.revenue)}% par rapport à la période précédente.`}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-indigo-100">
                <p className="text-sm font-medium text-foreground">Focus Occupation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.occupancyRate > 70
                    ? "Excellent taux d'occupation ! Pensez à optimiser vos tarifs pour les périodes de haute demande."
                    : "Votre taux d'occupation est modéré. Envisagez une promotion ciblée pour booster les réservations."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report, index) => {
          const isFinancialReport = report.title === 'Rapport financier complet';
          return (
            <div
              key={report.title}
              className="rounded-xl border bg-card p-6 shadow-soft hover:shadow-medium transition-all animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-secondary ${report.color}`}>
                    <report.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{report.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                {report.path ? (
                  <Button asChild variant="secondary" size="sm" className="ml-auto group">
                    <Link to={report.path} className="flex items-center gap-2">
                      Générer le rapport
                      <TrendingUp className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="ml-auto" disabled>
                    Générer
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </MainLayout>
  );
};

export default Reports;
