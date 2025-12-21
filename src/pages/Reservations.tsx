import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CreateBookingDialog } from '@/components/bookings/CreateBookingDialog';
import { CheckInDialog } from '@/components/bookings/CheckInDialog';
import { EditBookingDialog } from '@/components/bookings/EditBookingDialog';
import { CancelBookingDialog } from '@/components/bookings/CancelBookingDialog';
import { CheckoutDecisionDialog } from '@/components/checkout/CheckoutDecisionDialog';
import { ManagePaymentDialog } from '@/components/payments/ManagePaymentDialog';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InvoiceListForBooking } from '@/components/invoices/InvoiceListForBooking';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MoreHorizontal,
  LogIn,
  LogOut,
  Edit,
  XCircle,
  Trash2,
  Filter,
  BadgeCent
} from 'lucide-react';
import { useBookings, Booking, useDeleteBooking } from '@/hooks/useBookings';
import { useAllPayments, Payment } from '@/hooks/usePayments';
import { format, differenceInDays, isWithinInterval, parseISO, isPast, isToday, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useGlobalFilters } from '@/hooks/useGlobalFilters';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'status-badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  CONFIRMED: { label: 'Confirmé', className: 'status-badge bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  PENDING_CHECKOUT: { label: 'Départ en attente', className: 'status-badge bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse' },
  IN_PROGRESS: { label: 'en cours', className: 'status-badge bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  COMPLETED: { label: 'Terminée', className: 'status-badge bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  CANCELLED: { label: 'Annulée', className: 'status-badge bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'Payé', className: 'text-green-500' },
  PARTIAL: { label: 'Partiel', className: 'text-yellow-500' },
  UNPAID: { label: 'Non payé', className: 'text-red-500' },
};

const Reservations = () => {
  const { role } = useAuth();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: allPayments = [], isLoading: paymentsLoading } = useAllPayments();
  const { data: rooms = [] } = useRooms();
  const { data: exchangeRate } = useExchangeRate();
  const deleteBooking = useDeleteBooking();
  const rate = exchangeRate?.usd_to_cdf || 2800;

  // Utiliser le hook de filtres global
  const {
    options,
    setDateFilter,
    setStatusFilter,
    setSearchTerm,
    resetFilters,
  } = useGlobalFilters(bookings);

  // Autres états
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [managePaymentBooking, setManagePaymentBooking] = useState<Booking | null>(null);

  const bookingsWithPayments = useMemo(() => {
    const paymentsByBooking = new Map<string, number>();
    allPayments.forEach(p => {
      paymentsByBooking.set(p.booking_id, (paymentsByBooking.get(p.booking_id) || 0) + p.montant);
    });

    return bookings.map(b => {
      const totalPaid = paymentsByBooking.get(b.id) || 0;
      let paymentStatus: PaymentStatus = 'UNPAID';
      if (totalPaid >= b.prix_total) {
        paymentStatus = 'PAID';
      } else if (totalPaid > 0) {
        paymentStatus = 'PARTIAL';
      }
      return { ...b, totalPaid, paymentStatus };
    });
  }, [bookings, allPayments]);

  // Filtrer les réservations selon les options
  const filteredBookings = useMemo(() => {
    return bookingsWithPayments.filter(b => {
      // Filtre de recherche
      const searchLower = options.searchTerm?.toLowerCase() || '';
      const matchesSearch = !searchLower || (
        b.tenants?.nom?.toLowerCase().includes(searchLower) ||
        b.tenants?.prenom?.toLowerCase().includes(searchLower) ||
        b.rooms?.numero?.toLowerCase().includes(searchLower)
      );

      // Filtre de statut
      const matchesStatus = options.status.includes('all') ||
        options.status.some(s => s === b.status.toLowerCase().replace('_', '-'));

      // Filtre de date
      const bookingStart = parseISO(b.date_debut_prevue);
      let matchesDate = true;

      if (options.dateRange.type === 'today') {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        matchesDate = bookingStart >= todayStart && bookingStart <= todayEnd;
      } else if (options.dateRange.type === 'week') {
        const weekStart = startOfWeek(new Date(), { locale: fr });
        const weekEnd = endOfWeek(new Date(), { locale: fr });
        matchesDate = bookingStart >= weekStart && bookingStart <= weekEnd;
      } else if (options.dateRange.type === 'month') {
        const monthStart = startOfMonth(new Date());
        const monthEnd = endOfMonth(new Date());
        matchesDate = bookingStart >= monthStart && bookingStart <= monthEnd;
      } else if (options.dateRange.type === 'custom' && options.dateRange.startDate && options.dateRange.endDate) {
        const customStart = new Date(options.dateRange.startDate);
        const customEnd = new Date(options.dateRange.endDate);
        matchesDate = bookingStart >= customStart && bookingStart <= customEnd;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookingsWithPayments, options]);

  // Compter les filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (options.searchTerm) count++;
    if (options.dateRange.type !== 'today') count++;
    if (!options.status.includes('all')) count++;
    return count;
  }, [options]);

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(end, today);
  };

  const handleDelete = async () => {
    if (deleteBookingId) {
      await deleteBooking.mutateAsync(deleteBookingId);
      setDeleteBookingId(null);
    }
  };

  const getCheckoutRoom = (booking: Booking) => {
    return rooms.find(r => r.id === booking.room_id);
  };

  // Determine available actions for each booking
  const getAvailableActions = (booking: Booking) => {
    const isOver = ['COMPLETED', 'CANCELLED'].includes(booking.status);
    const arrivalDate = parseISO(booking.date_debut_prevue);
    const canPerformCheckIn = (isToday(arrivalDate) || isPast(arrivalDate)) && !booking.check_in_reel;

    if (booking.status === 'PENDING_CHECKOUT') {
      return {
        canCheckIn: false,
        canCheckOut: true,
        canEdit: false,
        canCancel: false,
        canDelete: false,
      };
    }

    const actions = {
      canCheckIn: (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && canPerformCheckIn,
      canCheckOut: (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && !!booking.check_in_reel && !booking.check_out_reel,
      canEdit: !isOver,
      canCancel: !isOver && !booking.check_in_reel,
      canDelete: isOver,
    };
    return actions;
  };

  const isLoading = bookingsLoading || paymentsLoading;

  if (isLoading) {
    return <MainLayout title="GESTION DES RÉSERVATIONS"><div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Chargement des réservations...</p></div></MainLayout>;
  }

  return (
    <MainLayout title="GESTION DES RÉSERVATIONS">
      <div className="space-y-6">
        {/* Nouveau composant de filtres */}
        <div className="border rounded-lg p-4 mb-6">
          <GlobalFilters
            searchTerm={options.searchTerm || ''}
            onSearchChange={setSearchTerm}
            dateFilter={options.dateRange.type}
            onDateFilterChange={setDateFilter}
            statusFilter={options.status}
            onStatusFilterChange={setStatusFilter}
            onReset={resetFilters}
            activeFiltersCount={activeFiltersCount}
          />
        </div>

        <div className="flex justify-end">
          {(role === 'ADMIN' || role === 'AGENT_RES') && <CreateBookingDialog />}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border">
            <p className="text-lg font-medium text-foreground mb-2">Aucune réservation trouvée</p>
            <p className="text-sm text-muted-foreground">Essayez de modifier vos filtres ou créez une nouvelle réservation.</p>
          </div>
        ) : (
          <>
            {/* Version mobile - Cartes */}
            <div className="md:hidden space-y-3">
              {filteredBookings.map((booking) => {
                const daysRemaining = calculateDaysRemaining(booking.date_fin_prevue);
                const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                const paymentStatusConfig = PAYMENT_STATUS_CONFIG[booking.paymentStatus];
                const actions = getAvailableActions(booking);

                return (
                  <div key={booking.id} className="bg-card rounded-lg border shadow-soft p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{booking.tenants?.prenom} {booking.tenants?.nom?.toUpperCase()}</h3>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", statusConfig.className)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">App. {booking.rooms?.numero} - {booking.rooms?.type}</p>
                        <div className="text-sm">
                          <p className="font-medium">${Number(booking.prix_total).toLocaleString('fr-FR')}</p>
                          <p className={paymentStatusConfig.className}>{paymentStatusConfig.label} (${booking.totalPaid.toLocaleString('fr-FR')})</p>
                        </div>
                        <div className="mt-2 text-xs">
                          <p>Du {format(new Date(booking.date_debut_prevue), 'dd/MM/yyyy')}</p>
                          <p>Au {format(new Date(booking.date_fin_prevue), 'dd/MM/yyyy')}</p>
                          {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
                            <p className={`font-medium ${daysRemaining < 0 ? 'text-destructive' : daysRemaining === 0 ? 'text-orange-500' : 'text-primary'}`}>
                              {daysRemaining < 0 ? `${Math.abs(daysRemaining)}j de retard` : daysRemaining === 0 ? 'Départ aujourd\'hui' : `${daysRemaining}j restants`}
                            </p>
                          )}
                          {booking.check_in_reel && !booking.check_out_reel && (
                            <p className="text-muted-foreground">Arrivé le {format(new Date(booking.check_in_reel), 'dd/MM HH:mm')}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
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
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Facture</p>
                      <InvoiceListForBooking bookingId={booking.id} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Version desktop - Tableau */}
            <div className="hidden md:block bg-card rounded-lg border shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="text-primary-foreground font-semibold">CLIENT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">APPARTEMENT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">STATUT</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">MONTANTS</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">DATES</TableHead>
                    <TableHead className="text-primary-foreground font-semibold">FACTURE</TableHead>
                    <TableHead className="text-primary-foreground font-semibold text-center">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => {
                    const daysRemaining = calculateDaysRemaining(booking.date_fin_prevue);
                    const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                    const paymentStatusConfig = PAYMENT_STATUS_CONFIG[booking.paymentStatus];
                    const actions = getAvailableActions(booking);

                    return (
                      <TableRow key={booking.id} className="hover:bg-secondary/50">
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-semibold">{booking.tenants?.prenom} {booking.tenants?.nom?.toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground">{booking.tenants?.telephone || 'Pas de téléphone'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">App. {booking.rooms?.numero}</p>
                            <p className="text-sm text-muted-foreground">{booking.rooms?.type}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={statusConfig.className}>{statusConfig.label}</span>
                          {booking.check_in_reel && !booking.check_out_reel && (
                            <p className="text-xs text-muted-foreground mt-1">Arrivé le {format(new Date(booking.check_in_reel), 'dd/MM HH:mm')}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-sm">
                            <p className="font-medium">${Number(booking.prix_total).toLocaleString('fr-FR')}</p>
                            <p className={paymentStatusConfig.className}>{paymentStatusConfig.label} (${booking.totalPaid.toLocaleString('fr-FR')})</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-sm">
                            <p>Du {format(new Date(booking.date_debut_prevue), 'dd/MM/yyyy')}</p>
                            <p>Au {format(new Date(booking.date_fin_prevue), 'dd/MM/yyyy')}</p>
                            {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
                              <p className={`text-xs font-medium ${daysRemaining < 0 ? 'text-destructive' : daysRemaining === 0 ? 'text-orange-500' : 'text-primary'}`}>
                                {daysRemaining < 0 ? `${Math.abs(daysRemaining)}j de retard` : daysRemaining === 0 ? 'Départ aujourd\'hui' : `${daysRemaining}j restants`}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm"><InvoiceListForBooking bookingId={booking.id} /></TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                              {actions.canDelete && role === 'ADMIN' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteBookingId(booking.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
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
      </div>

      {checkInBooking && <CheckInDialog booking={checkInBooking} open={!!checkInBooking} onOpenChange={(open) => !open && setCheckInBooking(null)} />}
      {checkOutBooking && getCheckoutRoom(checkOutBooking) && <CheckoutDecisionDialog booking={checkOutBooking} room={getCheckoutRoom(checkOutBooking)!} open={!!checkOutBooking} onOpenChange={(open) => !open && setCheckOutBooking(null)} />}
      {editBooking && <EditBookingDialog booking={editBooking} open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)} />}
      {cancelBooking && <CancelBookingDialog booking={cancelBooking} open={!!cancelBooking} onOpenChange={(open) => !open && setCancelBooking(null)} />}
      {managePaymentBooking && <ManagePaymentDialog booking={managePaymentBooking} open={!!managePaymentBooking} onClose={() => setManagePaymentBooking(null)} />}
      <AlertDialog open={!!deleteBookingId} onOpenChange={(open) => !open && setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer la réservation ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. La réservation sera définitivement supprimée.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Reservations;