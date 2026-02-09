import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreateBookingDialog } from '@/components/bookings/CreateBookingDialog';
import { CheckInDialog } from '@/components/bookings/CheckInDialog';
import { EditBookingDialog } from '@/components/bookings/EditBookingDialog';
import { CancelBookingDialog } from '@/components/bookings/CancelBookingDialog';
import { CheckoutDecisionDialog } from '@/components/checkout/CheckoutDecisionDialog';
import { ManagePaymentDialog } from '@/components/payments/ManagePaymentDialog';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { useLocations } from '@/hooks/useLocations';
import { useLocationFilter } from '@/context/LocationFilterContext';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InvoiceListForBooking } from '@/components/invoices/InvoiceListForBooking';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, LogIn, LogOut, Edit, XCircle, Trash2, BadgeCent, Search, Calendar as CalendarIcon, Filter, X, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { useBookings, Booking, useDeleteBooking, BookingFilters } from '@/hooks/useBookings';
import { useExchangeRate } from '@/hooks/useExchangeRate'; // Import pour conversion
import { format, differenceInCalendarDays, differenceInDays, parseISO, isPast, isToday, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, isAfter } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useBookingCounts } from '@/hooks/useBookingCounts';
import { useBookingCount } from '@/hooks/useBookingCount';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'status-badge bg-yellow-100 text-foreground dark:bg-yellow-900/30' },
  CONFIRMED: { label: 'Confirmé', className: 'status-badge bg-blue-100 text-foreground dark:bg-blue-900/30' },
  PENDING_CHECKOUT: { label: 'Départ en attente', className: 'status-badge bg-orange-100 text-foreground dark:bg-orange-900/30 animate-pulse' },
  IN_PROGRESS: { label: 'en cours', className: 'status-badge bg-green-100 text-foreground dark:bg-green-900/30' },
  COMPLETED: { label: 'Terminée', className: 'status-badge bg-gray-100 text-foreground dark:bg-gray-800' },
  CANCELLED: { label: 'Annulée', className: 'status-badge bg-red-100 text-foreground dark:bg-red-900/30' },
};

type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'Payé', className: 'text-green-500' },
  PARTIAL: { label: 'Partiel', className: 'text-yellow-500' },
  UNPAID: { label: 'Non payé', className: 'text-red-500' },
};

const Reservations = () => {
  const { role, profile } = useAuth();
  const { selectedLocationId } = useLocationFilter();
  const { data: locations } = useLocations();

  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'inprogress' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 });

  // Déterminer les statuts en fonction de l'onglet actif
  const getStatusFilter = (): string[] => {
    switch (activeTab) {
      case 'upcoming':
        return ['PENDING', 'CONFIRMED']; // Réservations futures
      case 'inprogress':
        return ['IN_PROGRESS']; // Réservations en cours
      case 'completed':
        return ['COMPLETED']; // Réservations terminées
      case 'cancelled':
        return ['CANCELLED']; // Réservations annulées
      case 'all':
      default:
        return []; // Tous les statuts
    }
  };

  const bookingFilters: BookingFilters = useMemo(() => {
    // Pour l'onglet "Tous", ne pas appliquer de filtres
    if (activeTab === 'all') {
      return {
        searchTerm: '',  // Ne pas appliquer le filtre de recherche non plus
        status: [],
        startDate: undefined,
        endDate: undefined,
      };
    }

    // Pour les autres onglets, appliquer les filtres normalement
    return {
      searchTerm,
      status: getStatusFilter(),
      startDate: dateRange.from?.toISOString(),
      endDate: dateRange.to?.toISOString(),
    };
  }, [activeTab, searchTerm, dateRange]);

  // Réinitialiser la pagination quand les filtres changent
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [searchTerm, activeTab, dateRange.from, dateRange.to]);

  // Charger les données pour l'onglet actif
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings(bookingFilters, pagination);
  const bookingsData = bookingsResult?.data || [];

  // Charger le nombre total de réservations correspondant aux filtres (pour la pagination)
  const { data: totalCount, isLoading: totalCountLoading } = useBookingCount(bookingFilters);
  const pageCount = totalCount ? Math.ceil(totalCount / pagination.pageSize) : 0;

  // Charger les totaux complets pour les badges de notification (sans filtres)
  const { data: totalBookingCounts, isLoading: totalCountsLoading } = useBookingCounts({});

  // Charger les totaux pour chaque catégorie avec les filtres de date (sauf pour l'onglet "Tous")
  const { data: filteredBookingCounts, isLoading: filteredCountsLoading } = useBookingCounts({
    startDate: activeTab === 'all' ? undefined : dateRange.from?.toISOString(),
    endDate: activeTab === 'all' ? undefined : dateRange.to?.toISOString(),
  });

  // Pour les badges, utiliser les totaux complets pour "Tous", mais les totaux filtrés pour les autres onglets
  const allBookingsCount = totalBookingCounts?.all || 0;
  const upcomingBookingsCount = activeTab === 'all' ? totalBookingCounts?.upcoming || 0 : filteredBookingCounts?.upcoming || 0;
  const inProgressBookingsCount = activeTab === 'all' ? totalBookingCounts?.inProgress || 0 : filteredBookingCounts?.inProgress || 0;
  const completedBookingsCount = activeTab === 'all' ? totalBookingCounts?.completed || 0 : filteredBookingCounts?.completed || 0;
  const cancelledBookingsCount = activeTab === 'all' ? totalBookingCounts?.cancelled || 0 : filteredBookingCounts?.cancelled || 0;

  // Déterminer si les données sont en cours de chargement
  const isLoading = bookingsLoading || totalCountsLoading || totalCountLoading || filteredCountsLoading;

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  const { data: rooms = [] } = useRooms();
  const deleteBooking = useDeleteBooking();

  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [managePaymentBooking, setManagePaymentBooking] = useState<Booking | null>(null);

  const processedBookings = useMemo(() => {
    const today = startOfToday();

    return bookingsData.map(b => {
      const summary = b.booking_financial_summary?.[0];
      const totalPaid = summary?.total_paid || 0;
      const totalInvoiced = summary?.total_invoiced || 0;

      // Real-time late stay calculation, as this is dynamic
      const endDate = startOfDay(parseISO(b.date_fin_prevue));
      let lateStayDebt = 0;
      let lateNights = 0;
      const isOverdue = isAfter(today, endDate) && b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && !b.check_out_reel;

      if (isOverdue) {
        lateNights = differenceInCalendarDays(today, endDate);
        const plannedNights = differenceInCalendarDays(endDate, startOfDay(parseISO(b.date_debut_prevue)));
        const dailyRate = plannedNights > 0 ? b.prix_total / plannedNights : (b.rooms?.type ? (rooms.find(r => r.type === b.rooms?.type)?.prix_base_nuit || 0) : (rooms.find(r => r.id === b.room_id)?.prix_base_nuit || 0));
        lateStayDebt = lateNights * dailyRate;
      }

      const currentTotalDue = totalInvoiced + lateStayDebt;

      let paymentStatus: PaymentStatus;
      if (summary?.payment_summary_status) {
        paymentStatus = summary.payment_summary_status as PaymentStatus;
      } else {
        paymentStatus = 'UNPAID';
        if (totalPaid > 0) {
          paymentStatus = totalPaid >= currentTotalDue - 0.01 ? 'PAID' : 'PARTIAL';
        }
      }

      return {
        ...b,
        totalPaid,
        balanceDue: currentTotalDue - totalPaid,
        paymentStatus,
        lateStayDebt,
        lateNights,
        isOverdue,
        currentTotalDue,
      };
    });
  }, [bookingsData, rooms]);

  const subtitle = useMemo(() => {
    if (role === 'ADMIN') {
      if (selectedLocationId && locations) {
        const locationName = locations.find(l => l.id === selectedLocationId)?.nom;
        return `Gérez les réservations pour le site : ${locationName || 'Inconnu'}`;
      }
      return "Gérez les réservations de tous les sites.";
    }
    if (profile?.locations?.nom) {
      return `Réservations pour la localité : ${profile.locations.nom}`;
    }
    if (profile?.location_id && locations) {
      const userLocation = locations.find(l => l.id === profile.location_id)?.nom;
      return `Réservations pour la localité : ${userLocation || 'Mon site'}`;
    }
    return "Gérez vos réservations.";
  }, [role, profile, selectedLocationId, locations]);

  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ from: undefined, to: undefined });
    // Réinitialiser aussi l'onglet à "Tous" si nécessaire
    setActiveTab('all');
  };

  const setTodayFilter = () => {
    const today = new Date();
    setDateRange({ from: startOfDay(today), to: endOfDay(today) });
  };

  const setWeekFilter = () => {
    const today = new Date();
    setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
  };

  const setMonthFilter = () => {
    const today = new Date();
    setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [searchTerm, dateRange]);

  const handleDelete = async () => {
    if (deleteBookingId) {
      await deleteBooking.mutateAsync(deleteBookingId);
      setDeleteBookingId(null);
    }
  };
  const getCheckoutRoom = (booking: Booking) => rooms.find(r => r.id === booking.room_id);

  const getAvailableActions = (booking: Booking) => {
    const isOver = ['COMPLETED', 'CANCELLED'].includes(booking.status);
    const arrivalDate = parseISO(booking.date_debut_prevue);
    const canPerformCheckIn = (isToday(arrivalDate) || isPast(arrivalDate)) && !booking.check_in_reel;
    if (booking.status === 'PENDING_CHECKOUT') return { canCheckIn: false, canCheckOut: true, canEdit: false, canCancel: false, canDelete: false };
    return {
      canCheckIn: (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && canPerformCheckIn,
      canCheckOut: (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && !!booking.check_in_reel && !booking.check_out_reel,
      canEdit: role === 'ADMIN' ? true : !isOver,
      canCancel: !isOver && !booking.check_in_reel,
      canDelete: isOver,
    };
  };

  return (
    <MainLayout title="GESTION DES RÉSERVATIONS" subtitle={subtitle}>
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border">
          <button
            className={`pb-3 px-4 font-medium text-sm ${activeTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('all')}
          >
            Tous
            {totalBookingCounts?.all !== undefined && totalBookingCounts.all > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs h-5 w-5">
                {totalBookingCounts.all}
              </span>
            )}
          </button>
          <button
            className={`pb-3 px-4 font-medium text-sm ${activeTab === 'upcoming' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('upcoming')}
          >
            À venir
            {totalBookingCounts?.upcoming !== undefined && totalBookingCounts.upcoming > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-xs h-5 w-5">
                {totalBookingCounts.upcoming}
              </span>
            )}
          </button>
          <button
            className={`pb-3 px-4 font-medium text-sm ${activeTab === 'inprogress' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('inprogress')}
          >
            En cours
            {totalBookingCounts?.inProgress !== undefined && totalBookingCounts.inProgress > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-green-500 text-white text-xs h-5 w-5">
                {totalBookingCounts.inProgress}
              </span>
            )}
          </button>
          <button
            className={`pb-3 px-4 font-medium text-sm ${activeTab === 'completed' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('completed')}
          >
            Terminées
            {totalBookingCounts?.completed !== undefined && totalBookingCounts.completed > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-gray-500 text-white text-xs h-5 w-5">
                {totalBookingCounts.completed}
              </span>
            )}
          </button>
          <button
            className={`pb-3 px-4 font-medium text-sm ${activeTab === 'cancelled' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Annulées
            {totalBookingCounts?.cancelled !== undefined && totalBookingCounts.cancelled > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs h-5 w-5">
                {totalBookingCounts.cancelled}
              </span>
            )}
          </button>
        </div>

        <Collapsible
          open={isFiltersOpen}
          onOpenChange={setIsFiltersOpen}
          className="space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={`Rechercher ${activeTab === 'all' ? 'toutes les réservations' : activeTab === 'upcoming' ? 'réservations à venir' : activeTab === 'inprogress' ? 'réservations en cours' : activeTab === 'completed' ? 'réservations terminées' : 'réservations annulées'}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>

            <CollapsibleTrigger asChild>
              <Button variant="outline" className="h-10">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filtres
                {activeFiltersCount > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </CollapsibleTrigger>

            <div className="hidden md:flex items-center gap-2 border-l pl-2 ml-auto">
              <span className="text-sm text-muted-foreground">Dates rapides:</span>
              <Button variant="outline" size="sm" onClick={setTodayFilter} className="text-xs h-9">Aujourd'hui</Button>
              <Button variant="outline" size="sm" onClick={setWeekFilter} className="text-xs h-9">Cette semaine</Button>
              <Button variant="outline" size="sm" onClick={setMonthFilter} className="text-xs h-9">Ce mois</Button>
            </div>

            <div className="flex-grow sm:flex-grow-0">
              {(role === 'ADMIN' || role === 'AGENT_RES') && <CreateBookingDialog />}
            </div>
          </div>

          <CollapsibleContent className="space-y-4 pt-2">
            <div className="border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild><Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange.from && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange.from ? format(dateRange.from, 'dd/MM/yy') : <span>Date de début</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.from} onSelect={(day) => setDateRange(prev => ({ ...prev, from: day as Date }))} initialFocus /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild><Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange.to && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange.to ? format(dateRange.to, 'dd/MM/yy') : <span>Date de fin</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.to} onSelect={(day) => setDateRange(prev => ({ ...prev, to: day as Date }))} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-4 w-4 mr-2" />Réinitialiser les filtres</Button>
                </div>
              </div>
              <div className="flex md:hidden items-center gap-2 border-t pt-4 mt-4">
                <span className="text-sm text-muted-foreground">Dates rapides:</span>
                <Button variant="outline" size="sm" onClick={setTodayFilter} className="text-xs h-9">Aujourd'hui</Button>
                <Button variant="outline" size="sm" onClick={setWeekFilter} className="text-xs h-9">Cette semaine</Button>
                <Button variant="outline" size="sm" onClick={setMonthFilter} className="text-xs h-9">Ce mois</Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isLoading ? <div className="text-center py-12">Chargement...</div> : processedBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border">
            <p className="text-lg font-medium text-foreground mb-2">Aucune réservation trouvée</p>
            <p className="text-sm text-muted-foreground">Essayez de modifier vos filtres ou créez une nouvelle réservation.</p>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border shadow-soft overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="text-primary-foreground font-semibold">CRÉÉE LE</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">CLIENT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">APPARTEMENT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">STATUT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">MONTANTS</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">DATES</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">NUITS</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">FACTURE</TableHead>
                    <TableHead className="text-primary-foreground font-semibold text-center">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedBookings.map((booking) => {
                    const numberOfNights = differenceInCalendarDays(new Date(booking.date_fin_prevue), new Date(booking.date_debut_prevue));
                    const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                    const paymentStatusConfig = PAYMENT_STATUS_CONFIG[booking.paymentStatus];
                    const actions = getAvailableActions(booking);
                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{format(new Date(booking.created_at), 'dd/MM/yyyy')}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(booking.created_at), 'HH:mm')}</span>
                          </div>
                        </TableCell>
                        <TableCell><p className="font-semibold">{booking.tenants?.prenom} {booking.tenants?.nom?.toUpperCase()}</p><p className="text-xs text-muted-foreground">{booking.tenants?.telephone}</p></TableCell>
                        <TableCell><p className="font-medium">App. {booking.rooms?.numero}</p><p className="text-sm text-muted-foreground">{booking.rooms?.type}</p></TableCell>
                        <TableCell><span className={statusConfig.className}>{statusConfig.label}</span></TableCell>
                        <TableCell className="p-0">
                          <div
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors group relative border-l-4 border-transparent hover:border-indigo-500"
                            onClick={() => setManagePaymentBooking(booking)}
                            title="Gérer les paiements"
                          >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <BadgeCent className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground group-hover:text-indigo-600 transition-colors">Prévu:</span>
                                <span className="font-bold">${Number(booking.prix_total).toLocaleString('fr-FR')}</span>
                              </div>

                              {booking.isOverdue && (
                                <div className="flex justify-between text-sm bg-red-50 p-1 rounded border border-red-100 animate-pulse">
                                  <span className="text-red-600 font-bold text-[10px] flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    DETTE ({booking.lateNights}j):
                                  </span>
                                  <span className="font-bold text-red-700">${Number(booking.lateStayDebt).toFixed(2)}</span>
                                </div>
                              )}

                              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                                <span className="text-muted-foreground">Total dû:</span>
                                <span className="font-extrabold text-indigo-900">${Number(booking.currentTotalDue).toLocaleString('fr-FR')}</span>
                              </div>

                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground group-hover:text-indigo-600 transition-colors">Payé:</span>
                                <span className={cn("font-bold", paymentStatusConfig.className)}>
                                  ${(Number(booking.totalPaid) || 0).toLocaleString('fr-FR')}
                                </span>
                              </div>

                              {booking.balanceDue > 0.01 && (
                                <div className="text-xs pt-1 border-t border-slate-100 mt-1">
                                  <div className="flex justify-between font-bold text-red-600 bg-red-50/50 px-1 rounded">
                                    <span>Reste:</span>
                                    <span>${(booking.balanceDue).toLocaleString('fr-FR')}</span>
                                  </div>
                                  <div className="text-right text-muted-foreground italic scale-90 origin-right mt-0.5">
                                    ~ {(booking.balanceDue * rate).toLocaleString('fr-FR')} FC
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><p>Du {format(new Date(booking.date_debut_prevue), 'dd/MM/yyyy')}</p><p>Au {format(new Date(booking.date_fin_prevue), 'dd/MM/yyyy')}</p></TableCell>
                        <TableCell className="text-center font-medium">{numberOfNights}</TableCell>
                        <TableCell><InvoiceListForBooking bookingId={booking.id} /></TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {actions.canCheckIn && (
                              <Button
                                size="sm"
                                onClick={() => setCheckInBooking(booking)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                title="Check-in"
                              >
                                <LogIn className="h-4 w-4 mr-1" />
                                Check-in
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {actions.canCheckIn && <DropdownMenuItem onClick={() => setCheckInBooking(booking)}><LogIn className="h-4 w-4 mr-2" />Check-in</DropdownMenuItem>}
                                {actions.canCheckOut && <DropdownMenuItem onClick={() => setCheckOutBooking(booking)}><LogOut className="h-4 w-4 mr-2" />Check-out</DropdownMenuItem>}
                                {(actions.canCheckIn || actions.canCheckOut) && <DropdownMenuSeparator />}
                                {actions.canEdit && <DropdownMenuItem onClick={() => setEditBooking(booking)}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>}
                                {actions.canEdit && <DropdownMenuItem onClick={() => setManagePaymentBooking(booking)}><BadgeCent className="h-4 w-4 mr-2" />Gérer les paiements</DropdownMenuItem>}
                                {actions.canCancel && <DropdownMenuItem onClick={() => setCancelBooking(booking)} className="text-orange-600"><XCircle className="h-4 w-4 mr-2" />Annuler</DropdownMenuItem>}
                                {actions.canDelete && role === 'ADMIN' && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setDeleteBookingId(booking.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem></>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {bookingsData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
            <div className="text-sm text-muted-foreground">
              Affichage de {(pagination.pageIndex * pagination.pageSize) + 1} à {Math.min((pagination.pageIndex + 1) * pagination.pageSize, (bookingsResult?.count || 0))} sur {bookingsResult?.count || 0} réservation{bookingsResult?.count !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Lignes par page:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    setPagination(prev => ({ ...prev, pageIndex: 0, pageSize: Number(e.target.value) }));
                  }}
                  className="h-8 border rounded-md px-2 text-sm bg-background"
                >
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }));
                  }}
                  disabled={pagination.pageIndex === 0}
                >
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.pageIndex + 1} sur {pageCount || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }));
                  }}
                  disabled={pagination.pageIndex >= pageCount - 1 || pageCount <= 1 || !bookingsResult?.count}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {checkInBooking && <CheckInDialog booking={checkInBooking} open={!!checkInBooking} onOpenChange={(open) => !open && setCheckInBooking(null)} />}
      {checkOutBooking && getCheckoutRoom(checkOutBooking) && <CheckoutDecisionDialog booking={checkOutBooking} room={getCheckoutRoom(checkOutBooking)!} open={!!checkOutBooking} onOpenChange={(open) => !open && setCheckOutBooking(null)} />}
      {editBooking && <EditBookingDialog booking={editBooking} open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)} />}
      {cancelBooking && <CancelBookingDialog booking={cancelBooking} open={!!cancelBooking} onOpenChange={(open) => !open && setCancelBooking(null)} />}
      {managePaymentBooking && <ManagePaymentDialog booking={managePaymentBooking} open={!!managePaymentBooking} onClose={() => setManagePaymentBooking(null)} />}
      <AlertDialog open={!!deleteBookingId} onOpenChange={(open) => !open && setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer la réservation ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. La réservation sera définitivement supprimée.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Reservations;
