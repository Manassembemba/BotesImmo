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
import { MoreHorizontal, LogIn, LogOut, Edit, XCircle, Trash2, BadgeCent, Search, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { useBookings, Booking, useDeleteBooking, BookingFilters } from '@/hooks/useBookings';
import { usePaymentsForBookings } from '@/hooks/usePayments';
import { format, differenceInCalendarDays, differenceInDays, parseISO, isPast, isToday } from 'date-fns';
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

  const bookingIds = useMemo(() => bookingsData.map(b => b.id), [bookingsData]);
  const { data: paymentsForBookings = [], isLoading: paymentsLoading } = usePaymentsForBookings(bookingIds);
  
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
    return bookingsData.map(b => {
      const totalPaid = paymentsByBooking.get(b.id) || 0;
      let paymentStatus: PaymentStatus = 'UNPAID';
      if (totalPaid > 0) {
        paymentStatus = totalPaid >= b.prix_total ? 'PAID' : 'PARTIAL';
      }
      return { ...b, totalPaid, paymentStatus };
    });
  }, [bookingsData, paymentsForBookings]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
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

  const isLoading = bookingsLoading || paymentsLoading;

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
            <div className="md:hidden space-y-3">
              {/* Mobile View Here */}
            </div>
            <div className="hidden md:block bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
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
                        <TableCell><p className="font-semibold">{booking.tenants?.prenom} {booking.tenants?.nom?.toUpperCase()}</p><p className="text-xs text-muted-foreground">{booking.tenants?.telephone}</p></TableCell>
                        <TableCell><p className="font-medium">App. {booking.rooms?.numero}</p><p className="text-sm text-muted-foreground">{booking.rooms?.type}</p></TableCell>
                        <TableCell><span className={statusConfig.className}>{statusConfig.label}</span></TableCell>
                        <TableCell><p className="font-medium">${Number(booking.prix_total).toLocaleString('fr-FR')}</p><p className={paymentStatusConfig.className}>{paymentStatusConfig.label} (${booking.totalPaid.toLocaleString('fr-FR')})</p></TableCell>
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