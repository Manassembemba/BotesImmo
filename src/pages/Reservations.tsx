import { useState, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InvoiceListForBooking } from '@/components/invoices/InvoiceListForBooking';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, LogIn, LogOut, Edit, XCircle, Trash2, BadgeCent, Search, Calendar as CalendarIcon, Filter, X, AlertTriangle } from 'lucide-react';
import { usePaymentsForBookings } from '@/hooks/usePayments';
import { useBookings, Booking, useDeleteBooking, BookingFilters } from '@/hooks/useBookings';
import { useInvoices } from '@/hooks/useInvoices';
import { useExchangeRate } from '@/hooks/useExchangeRate'; // Import pour conversion
import { format, differenceInCalendarDays, differenceInDays, parseISO, isPast, isToday, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, isAfter } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  const { role } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 });

  const bookingFilters: BookingFilters = useMemo(() => ({
    searchTerm,
    status: statusFilter === 'all' ? [] : [statusFilter],
    startDate: dateRange.from?.toISOString(),
    endDate: dateRange.to?.toISOString(),
  }), [searchTerm, statusFilter, dateRange]);

  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings(bookingFilters, pagination);
  const bookingsData = bookingsResult?.data || [];
  const pageCount = bookingsResult?.count ? Math.ceil(bookingsResult.count / pagination.pageSize) : 0;
  const { data: exchangeRateData } = useExchangeRate(); // Récupérer taux
  const rate = exchangeRateData?.usd_to_cdf || 2800;
  const bookingIds = useMemo(() => bookingsData.map(b => b.id), [bookingsData]);
  const { data: paymentsForBookings = [], isLoading: paymentsLoading } = usePaymentsForBookings(bookingIds);
  const { data: invoicesResult, isLoading: invoicesLoading } = useInvoices({ pagination: { pageIndex: 0, pageSize: 1000 } }); // Fetch all invoices to match totals
  const invoices = invoicesResult?.data || [];

  const { data: rooms = [] } = useRooms();
  const deleteBooking = useDeleteBooking();

  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [managePaymentBooking, setManagePaymentBooking] = useState<Booking | null>(null);

  const bookingsWithPayments = useMemo(() => {
    const paymentsByBooking = new Map<string, number>();
    paymentsForBookings.forEach(p => {
      paymentsByBooking.set(p.booking_id, (paymentsByBooking.get(p.booking_id) || 0) + p.montant);
    });

    const invoiceByBooking = new Map<string, number>();
    invoices.forEach(inv => {
      if (inv.booking_id && inv.status !== 'CANCELLED') {
        // Sum up totals if multiple active invoices (rare but safer)
        invoiceByBooking.set(inv.booking_id, (invoiceByBooking.get(inv.booking_id) || 0) + inv.total);
      }
    });

    const today = startOfToday();

    return bookingsData.map(b => {
      const totalPaid = paymentsByBooking.get(b.id) || 0;

      // Late Stay Calculation
      const startDate = startOfDay(parseISO(b.date_debut_prevue));
      const endDate = startOfDay(parseISO(b.date_fin_prevue));
      const plannedNights = differenceInCalendarDays(endDate, startDate);

      let lateStayDebt = 0;
      let lateNights = 0;
      const isOverdue = isAfter(today, endDate) && b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && !b.check_out_reel;

      if (isOverdue) {
        lateNights = differenceInCalendarDays(today, endDate);
        // Calculate negotiated daily rate
        const dailyRate = plannedNights > 0 ? b.prix_total / plannedNights : (rooms.find(r => r.id === b.room_id)?.prix_base_nuit || 0);
        lateStayDebt = lateNights * dailyRate;
      }

      // Logic: If invoice exists, use Invoice Total as the truth. Else use booking price + potential debt.
      const invoiceTotal = invoiceByBooking.get(b.id);
      const currentTotalWithLate = invoiceTotal ? invoiceTotal : (b.prix_total + lateStayDebt);

      let paymentStatus: PaymentStatus = 'UNPAID';
      if (totalPaid > 0) {
        paymentStatus = totalPaid >= currentTotalWithLate - 0.01 ? 'PAID' : 'PARTIAL';
      }

      return {
        ...b,
        totalPaid,
        paymentStatus,
        lateStayDebt,
        lateNights,
        isOverdue,
        currentTotalWithLate
      };
    });
  }, [bookingsData, paymentsForBookings, rooms]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
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
    if (statusFilter !== 'all') count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [searchTerm, statusFilter, dateRange]);

  const calculateDaysRemaining = (endDate: string) => differenceInDays(new Date(endDate), new Date());
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
      canEdit: !isOver,
      canCancel: !isOver && !booking.check_in_reel,
      canDelete: isOver,
    };
  };

  const isLoading = bookingsLoading || paymentsLoading || invoicesLoading;

  return (
    <MainLayout title="GESTION DES RÉSERVATIONS">
      <div className="space-y-6">
        <div className="border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par locataire, chambre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Statut de la réservation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([status, { label }]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange.from && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange.from ? format(dateRange.from, 'dd/MM/yy') : <span>Date de début</span>}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.from} onSelect={(day) => setDateRange(prev => ({ ...prev, from: day as Date }))} initialFocus /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange.to && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange.to ? format(dateRange.to, 'dd/MM/yy') : <span>Date de fin</span>}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.to} onSelect={(day) => setDateRange(prev => ({ ...prev, to: day as Date }))} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-2 border-t mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={setTodayFilter}
                className="text-xs h-8"
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setWeekFilter}
                className="text-xs h-8"
              >
                Cette semaine
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setMonthFilter}
                className="text-xs h-8"
              >
                Ce mois
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 pt-2 border-t">
            <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">{activeFiltersCount} filtre(s) actif(s)</span></div>
            <Button variant="outline" size="sm" onClick={resetFilters}><span className="mr-1">Réinitialiser</span><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex justify-end">{(role === 'ADMIN' || role === 'AGENT_RES') && <CreateBookingDialog />}</div>

        {isLoading ? <div className="text-center py-12">Chargement...</div> : bookingsWithPayments.length === 0 ? (
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
                  {bookingsWithPayments.map((booking) => {
                    const daysRemaining = calculateDaysRemaining(booking.date_fin_prevue);
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
                                <span className="font-extrabold text-indigo-900">${Number(booking.currentTotalWithLate).toLocaleString('fr-FR')}</span>
                              </div>

                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground group-hover:text-indigo-600 transition-colors">Payé:</span>
                                <span className={cn("font-bold", paymentStatusConfig.className)}>
                                  ${(Number(booking.totalPaid) || 0).toLocaleString('fr-FR')}
                                </span>
                              </div>

                              {Number(booking.currentTotalWithLate) - (Number(booking.totalPaid) || 0) > 0.01 && (
                                <div className="text-xs pt-1 border-t border-slate-100 mt-1">
                                  <div className="flex justify-between font-bold text-red-600 bg-red-50/50 px-1 rounded">
                                    <span>Reste:</span>
                                    <span>${(Number(booking.currentTotalWithLate) - Number(booking.totalPaid)).toLocaleString('fr-FR')}</span>
                                  </div>
                                  <div className="text-right text-muted-foreground italic scale-90 origin-right mt-0.5">
                                    ~ {((Number(booking.currentTotalWithLate) - Number(booking.totalPaid)) * rate).toLocaleString('fr-FR')} FC
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))} disabled={pagination.pageIndex === 0}>Précédent</Button>
          <span className="text-sm text-muted-foreground">Page {pagination.pageIndex + 1} sur {pageCount || 1}</span>
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))} disabled={pagination.pageIndex >= pageCount - 1}>Suivant</Button>
        </div>
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