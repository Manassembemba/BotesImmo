import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { CreateBookingDialog } from '@/components/bookings/CreateBookingDialog';
import { CheckoutDecisionDialog } from '@/components/checkout/CheckoutDecisionDialog';
import { CheckInDialog } from '@/components/bookings/CheckInDialog';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Search,
  UserPlus,
  AlertTriangle,
  BadgeCent,
  ArrowLeft,
  ArrowRight,
  LogIn,
  LogOut,
  Eye
} from 'lucide-react';
import { useRooms, Room } from '@/hooks/useRooms';
import { useBookings, Booking } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
  parseISO,
  differenceInDays,
  isToday,
  isSaturday,
  isSunday,
  isAfter,
  isBefore,
  startOfToday,
  startOfDay,
  endOfDay,
  areIntervalsOverlapping
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

// High-contrast colors
// Premium Nguma Colors with deeper gradients
// Premium Nguma Colors with deeper, more vibrant gradients
const STATUS_COLORS: Record<string, { label: string; bg: string; text: string; light: string; border: string }> = {
  PENDING: {
    label: 'En attente',
    bg: 'bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500',
    text: 'text-white shadow-sm',
    light: 'bg-amber-100/50',
    border: 'border-amber-400/50'
  },
  CONFIRMED: {
    label: 'Confirmé',
    bg: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600',
    text: 'text-white shadow-sm',
    light: 'bg-sky-100/50',
    border: 'border-sky-400/50'
  },
  IN_PROGRESS: {
    label: 'En cours',
    bg: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600',
    text: 'text-white shadow-sm',
    light: 'bg-emerald-100/50',
    border: 'border-emerald-400/50'
  },
  PENDING_CHECKOUT: {
    label: 'Départ imminent',
    bg: 'bg-gradient-to-br from-rose-400 via-rose-500 to-pink-600',
    text: 'text-white shadow-sm',
    light: 'bg-rose-100/50',
    border: 'border-rose-400/50'
  },
  COMPLETED: {
    label: 'Terminé',
    bg: 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600',
    text: 'text-white',
    light: 'bg-slate-100/30',
    border: 'border-slate-300'
  },
  CANCELLED: {
    label: 'Annulé',
    bg: 'bg-gradient-to-br from-red-500 via-red-600 to-red-700',
    text: 'text-white',
    light: 'bg-red-100/30',
    border: 'border-red-300'
  },
};

const getRoomStatusColor = (status: string) => {
  switch (status) {
    case 'Libre': return 'bg-emerald-500';
    case 'Occupé': return 'bg-blue-500';
    case 'Maintenance':
    case 'MAINTENANCE':
      return 'bg-slate-500';
    case 'PENDING_CHECKOUT':
      return 'bg-amber-500';
    case 'BOOKED':
      return 'bg-indigo-400';
    default: return 'bg-slate-300';
  }
};

const getRoomBgTint = (status: string) => {
  switch (status) {
    case 'Libre': return 'bg-emerald-50/20';
    case 'Occupé': return 'bg-blue-50/30';
    case 'Maintenance':
    case 'MAINTENANCE':
      return 'bg-slate-50/30';
    case 'PENDING_CHECKOUT':
      return 'bg-amber-50/30';
    default: return '';
  }
};

const VIEW_OPTIONS = [
  { value: '14', label: '2 semaines' },
  { value: '30', label: '1 mois' },
  { value: '7', label: '1 semaine' },
];

type Selection = {
  start: Date | null;
  end: Date | null;
  roomId: string | null;
};

const Planning = () => {
  const { role } = useAuth();
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewDays, setViewDays] = useState('30');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const days = useMemo(() => {
    const numDays = parseInt(viewDays);
    if (numDays === 30) {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
    return Array.from({ length: numDays }, (_, i) => addDays(currentDate, i));
  }, [currentDate, viewDays]);

  // Déterminer la plage de dates pour la requête SQL
  const { queryStartDate, queryEndDate } = useMemo(() => {
    if (days.length === 0) return { queryStartDate: null, queryEndDate: null };
    return {
      queryStartDate: days[0],
      queryEndDate: days[days.length - 1],
    };
  }, [days]);

  // Charger uniquement les réservations nécessaires pour la période visible
  const { data: bookingsResult, isLoading: bookingsLoading } = useBookings({
    startDate: queryStartDate?.toISOString(),
    endDate: queryEndDate?.toISOString(),
  });
  const bookings = bookingsResult?.data || [];

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);

  // State for creating a booking from the calendar
  const [selection, setSelection] = useState<Selection>({ start: null, end: null, roomId: null });
  const [bookingDialog, setBookingDialog] = useState<{ open: boolean; initialData?: any }>({ open: false });



  // Extraire les types uniques et localités
  const uniqueRoomTypes = useMemo(() => {
    const types = new Set(rooms.map(room => room.type));
    return ['all', ...Array.from(types)];
  }, [rooms]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set(rooms.map(room => room.locations?.nom).filter(Boolean));
    return ['all', ...Array.from(locations as Set<string>)];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room =>
      (room.numero.toLowerCase().includes(search.toLowerCase()) ||
        room.type.toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter === 'all' ||
        bookings.some(b => b.room_id === room.id && b.status === statusFilter)) &&
      (roomTypeFilter === 'all' || room.type === roomTypeFilter) &&
      (locationFilter === 'all' || room.locations?.nom === locationFilter)
    );
  }, [rooms, search, statusFilter, roomTypeFilter, locationFilter, bookings]);



  // ... (other imports)

  const getReservationForDay = (bookings: Booking[], roomId: string, day: Date) => {
    return bookings.find(b => {
      if (b.room_id !== roomId || b.status === 'CANCELLED') return false;
      try {
        const bookingInterval = {
          start: parseISO(b.date_debut_prevue),
          end: parseISO(b.date_fin_prevue)
        };
        const dayInterval = {
          start: startOfDay(day),
          end: endOfDay(day)
        };

        // A booking that ends exactly at the start of the day shouldn't count for that day.
        if (bookingInterval.end.getTime() === dayInterval.start.getTime()) return false;

        return areIntervalsOverlapping(bookingInterval, dayInterval, { inclusive: true });
      } catch (e) {
        return false;
      }
    });
  };

  const handleCellClick = (room: Room, day: Date) => {
    const today = startOfToday();

    if (!selection.start || selection.roomId !== room.id) {
      // First click: start selection
      if (isBefore(day, today)) {
        toast({
          title: "Date invalide",
          description: "Vous ne pouvez pas sélectionner une date passée.",
          variant: "destructive",
        });
        return;
      }
      setSelection({ start: day, end: null, roomId: room.id });
    } else {
      // Second click: end selection
      const startDate = selection.start;
      const endDate = day;

      if (isBefore(endDate, startDate)) {
        toast({
          title: "Date invalide",
          description: "La date de départ ne peut pas être antérieure à la date d'arrivée.",
          variant: "destructive",
        });
        setSelection({ start: day, end: null, roomId: room.id });
        return;
      }

      // Create Date objects with the default times
      const finalStartDate = new Date(startDate);
      finalStartDate.setHours(12, 0, 0, 0);

      const finalEndDate = new Date(endDate);
      finalEndDate.setHours(11, 0, 0, 0);

      // Open dialog with pre-filled data
      setBookingDialog({
        open: true,
        initialData: {
          roomId: room.id,
          startDate: finalStartDate.toISOString(),
          endDate: finalEndDate.toISOString(),
        },
      });
      // Reset selection
      setSelection({ start: null, end: null, roomId: null });
    }
  };

  const handleCellMouseEnter = (room: Room, day: Date) => {
    if (selection.start && selection.roomId === room.id) {
      const today = startOfToday();
      if (isBefore(day, today) && !isSameDay(day, today)) { // Prevent hovering into past
        // Optionally, reset selection or just don't update end
        // For now, allow selection into past, but will be validated on second click
        return;
      }
      setSelection(prev => ({ ...prev, end: day }));
    }
  };

  const isDayInSelection = (day: Date, roomId: string) => {
    if (!selection.start || !selection.end || selection.roomId !== roomId) return false;
    const start = isBefore(selection.start, selection.end) ? selection.start : selection.end;
    const end = isBefore(selection.start, selection.end) ? selection.end : selection.start;
    return isWithinInterval(day, { start, end });
  };

  // Helper to detect anomalies
  const getBookingAnomalies = (booking: Booking) => {
    const today = startOfToday();
    const endDate = startOfDay(parseISO(booking.date_fin_prevue));

    const isOverdue = isAfter(today, endDate) && booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && !booking.check_out_reel;

    // Detect debt from the financial summary join
    const financialSummary = booking.booking_financial_summary?.[0];
    const hasDebt = financialSummary ? financialSummary.balance_due > 0 : false;

    return { isOverdue, hasDebt, balanceDue: financialSummary?.balance_due || 0 };
  };

  const getReservationDisplay = (reservation: Booking, day: Date) => {
    const start = parseISO(reservation.date_debut_prevue);
    const end = parseISO(reservation.date_fin_prevue);
    const isStart = isSameDay(day, start);
    const isEnd = isSameDay(day, end);
    const anomalies = getBookingAnomalies(reservation);

    return { isStart, isEnd, ...anomalies };
  };

  const goToPrevious = () => {
    const numDays = parseInt(viewDays);
    if (numDays === 30) setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -numDays));
  };

  const goToNext = () => {
    const numDays = parseInt(viewDays);
    if (numDays === 30) setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, numDays));
  };

  const goToToday = () => setCurrentDate(new Date());

  const isLoading = roomsLoading || bookingsLoading;
  const getCheckoutRoom = (booking: Booking) => rooms.find(r => r.id === booking.room_id);

  const canCheckIn = selectedBooking?.status === 'CONFIRMED' && !selectedBooking.check_in_reel;
  const canCheckOut = selectedBooking?.status === 'CONFIRMED' && !!selectedBooking.check_in_reel && !selectedBooking.check_out_reel;

  if (isLoading) {
    return <MainLayout title="CALENDRIER DES LOCATIONS"><div className="p-8 text-center">Chargement...</div></MainLayout>;
  }

  return (
    <MainLayout title="CALENDRIER DES LOCATIONS">
      <div className="space-y-6 bg-slate-50 -m-6 p-6 min-h-screen">
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-300">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full">
            {Object.entries(STATUS_COLORS).map(([status, { label, bg }]) => (
              <div key={status} className="flex items-center gap-2 text-sm py-1">
                <div className={cn('w-4 h-4 rounded-sm', bg)} />
                <span className="text-slate-600 capitalize font-medium">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 h-10 border-slate-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-slate-300">
                <SelectValue placeholder="Tous statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="CONFIRMED">Confirmé</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="COMPLETED">Terminé</SelectItem>
                <SelectItem value="CANCELLED">Annulé</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
              <SelectTrigger className="border-slate-300">
                <SelectValue placeholder="Tous types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {uniqueRoomTypes.filter(type => type !== 'all').map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="border-slate-300">
                <SelectValue placeholder="Tous lieux" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous lieux</SelectItem>
                {uniqueLocations.filter(loc => loc !== 'all').map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-slate-500">
              {filteredRooms.length} / {rooms.length} appartements
            </div>
            {(role === 'ADMIN' || role === 'AGENT_RES') && (
              <Button className="gap-2 shadow-sm hover:shadow-md transition-all bg-indigo-600 hover:bg-indigo-700" onClick={() => setBookingDialog({ open: true })}>
                <Plus className="h-4 w-4" />
                Nouvelle réservation
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-300 shadow-xl overflow-hidden bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-300 bg-slate-100">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-white border-slate-300" onClick={goToPrevious}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="bg-white border-slate-300" onClick={goToNext}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="secondary" size="sm" className="bg-white border-slate-300 text-slate-800" onClick={goToToday}>Aujourd'hui</Button>
            </div>
            <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight">{format(currentDate, 'MMMM yyyy', { locale: fr })}</h3>
            <Select value={viewDays} onValueChange={setViewDays}>
              <SelectTrigger className="w-[140px] border-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>{VIEW_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="min-w-[1400px] relative">
              {/* Today Vertical Line Indicator */}
              {days.map((day, idx) => {
                if (isToday(day)) {
                  return (
                    <div
                      key="today-line"
                      className="absolute top-0 bottom-0 z-30 w-[2px] bg-primary/40 pointer-events-none"
                      style={{
                        left: `calc(150px + (100% - 150px) * ${idx} / ${days.length} + (100% - 150px) / ${days.length} / 2)`,
                      }}
                    >
                      <div className="absolute top-0 -left-[5px] w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] animate-pulse" />
                      <div className="h-full w-full bg-gradient-to-b from-primary/50 via-primary/20 to-primary/50" />
                    </div>
                  );
                }
                return null;
              })}

              <div className="grid border-b border-slate-300 bg-slate-100" style={{ gridTemplateColumns: `150px repeat(${days.length}, 1fr)` }}>
                <div className="p-3 font-bold text-slate-900 border-r border-slate-300 sticky left-0 bg-slate-100 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-widest flex items-center">Appartements</div>
                {days.map((day) => {
                  const isWeekend = isSaturday(day) || isSunday(day);
                  return (
                    <div key={day.toISOString()} className={cn('p-1 text-center border-r border-slate-300', isWeekend && 'bg-slate-200', isToday(day) && 'bg-indigo-100')}>
                      <p className={cn('text-[10px] uppercase tracking-wider font-bold', isWeekend ? 'text-slate-600' : 'text-slate-700')}>{format(day, 'EEE', { locale: fr })}</p>
                      <p className={cn('font-bold text-base', isToday(day) ? 'text-indigo-800' : 'text-slate-900')}>{format(day, 'd')}</p>
                    </div>
                  );
                })}
              </div>

              <TooltipProvider delayDuration={100}>
                {filteredRooms.map((room, idx) => (
                  <div key={room.id} className={cn("grid border-b border-slate-300 group transition-colors", getRoomBgTint(room.status), "hover:bg-indigo-50/50")} style={{ gridTemplateColumns: `150px repeat(${days.length}, 1fr)` }}>
                    <div className={cn("p-3 border-r border-slate-300 sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.03)] flex items-center gap-3", idx % 2 === 0 ? "bg-slate-50" : "bg-slate-100", "group-hover:bg-indigo-50")}>
                      <div className={cn("w-3 h-3 rounded-full ring-2 ring-white shrink-0 shadow-md", getRoomStatusColor(room.status))} />
                      <div className="flex flex-col min-w-0">
                        <p className="font-bold text-slate-900 leading-tight">App. {room.numero}</p>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">{room.type}</p>
                      </div>
                    </div>
                    {days.map((day) => {
                      const reservation = getReservationForDay(bookings, room.id, day);
                      const isWeekend = isSaturday(day) || isSunday(day);
                      const isTodayCell = isToday(day);
                      const inSelection = isDayInSelection(day, room.id);

                      return (
                        <div key={day.toISOString()}
                          className={cn(
                            'border-r border-slate-300 min-h-[70px] cursor-pointer relative group/cell',
                            isWeekend && 'bg-slate-100',
                            isTodayCell && 'bg-indigo-100',
                            inSelection && 'bg-indigo-100',
                          )}
                          onClick={() => handleCellClick(room, day)}
                          onMouseEnter={() => handleCellMouseEnter(room, day)}
                        >
                          {reservation ? (() => {
                            const { isStart, isEnd, isOverdue, hasDebt, balanceDue } = getReservationDisplay(reservation, day);
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      'absolute inset-y-1 inset-x-0 flex items-center text-[10px] font-bold overflow-hidden z-20 transition-all hover:scale-[1.02] hover:shadow-lg shadow-md',
                                      isStart ? 'rounded-l-lg ml-1' : '',
                                      isEnd ? 'rounded-r-lg mr-1' : '',
                                      !isStart && !isEnd ? 'rounded-none border-x-0' : '',
                                      isOverdue
                                        ? "bg-gradient-to-br from-red-600 via-rose-700 to-red-800 animate-pulse border-2 border-white shadow-lg shadow-red-500/50"
                                        : STATUS_COLORS[reservation.status]?.bg || "bg-slate-400",
                                      'border-y border-white/20 backdrop-blur-sm shadow-md',
                                      hasDebt && "ring-2 ring-amber-400 ring-offset-1"
                                    )}
                                  >
                                    <div className="w-full px-2 truncate flex items-center justify-center gap-1">
                                      {isStart && (
                                        <>
                                          {isOverdue ? (
                                            <AlertTriangle className="h-3 w-3 text-white shrink-0" />
                                          ) : hasDebt ? (
                                            <BadgeCent className="h-3 w-3 text-white shrink-0" />
                                          ) : (
                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                                          )}
                                        </>
                                      )}

                                      <span className={cn('truncate', STATUS_COLORS[reservation.status]?.text)}>
                                        {(isStart || (days.length <= 14)) && `${reservation.tenants?.prenom} ${reservation.tenants?.nom}`}
                                        {isStart && isOverdue && " (RETARD)"}
                                        {isStart && hasDebt && !isOverdue && ` (${balanceDue.toFixed(2)}$)`}
                                      </span>

                                      {isEnd && !isStart && (
                                        <LogOut className="h-3 w-3 text-white/80 shrink-0 ml-auto" />
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white/80 backdrop-blur-md border-indigo-100 shadow-xl p-3 w-56">
                                  <div className="space-y-2">
                                    <p className="font-bold text-indigo-900 border-b pb-1 mb-1">{reservation.tenants?.prenom} {reservation.tenants?.nom}</p>
                                    <p className="text-xs flex justify-between"><span>Période:</span> <span>{format(parseISO(reservation.date_debut_prevue), 'dd/MM/yy HH:mm')} - {format(parseISO(reservation.date_fin_prevue), 'dd/MM/yy HH:mm')}</span></p>
                                    {isOverdue && (
                                      <p className="text-xs font-bold text-red-600 flex items-center gap-1 bg-red-50 p-1 rounded">
                                        <AlertTriangle className="h-3 w-3" /> ATTENTION : Départ dépassé !
                                      </p>
                                    )}
                                    {hasDebt && (
                                      <p className="text-xs font-bold text-orange-600 flex items-center gap-1 bg-orange-50 p-1 rounded">
                                        <BadgeCent className="h-3 w-3" /> Solde dû : {balanceDue.toFixed(2)} $
                                      </p>
                                    )}
                                    <Button size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => setSelectedBooking(reservation)}>
                                      <Eye className="h-3 w-3 mr-2" />
                                      Voir les détails
                                    </Button>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()
                            : (
                              selection.start && selection.roomId === room.id && isSameDay(day, selection.start) && (
                                <div className="absolute inset-0 bg-primary/50 rounded-md border-2 border-primary" />
                              )
                            )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      <CreateBookingDialog
        open={bookingDialog.open}
        onOpenChange={(open) => setBookingDialog({ open })}
        initialData={bookingDialog.initialData}
      />

      {selectedBooking && (
        <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Détails de la réservation
              </DialogTitle>
              <DialogDescription className="sr-only">
                Détails de la réservation sélectionnée.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">
                      {selectedBooking.tenants?.prenom} {selectedBooking.tenants?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBooking.tenants?.telephone || 'Pas de téléphone'}
                    </p>
                  </div>
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    STATUS_COLORS[selectedBooking.status]?.bg,
                    STATUS_COLORS[selectedBooking.status]?.text
                  )}>
                    {selectedBooking.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Appartement</p>
                    <p className="font-medium">App. {selectedBooking.rooms?.numero} ({selectedBooking.rooms?.type})</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Montant total</p>
                    <CurrencyDisplay amountUSD={Number(selectedBooking.prix_total)} className="font-semibold" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Arrivée</p>
                    <p className="font-medium">
                      {format(parseISO(selectedBooking.date_debut_prevue), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Départ</p>
                    <p className="font-medium">
                      {format(parseISO(selectedBooking.date_fin_prevue), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                {selectedBooking.check_in_reel && (
                  <div className="pt-2 border-t text-sm">
                    <p className="text-green-600 font-medium flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Check-in le {format(parseISO(selectedBooking.check_in_reel), 'dd/MM/yyyy à HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                {canCheckIn && (
                  <Button
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setCheckInBooking(selectedBooking);
                      setSelectedBooking(null);
                    }}
                  >
                    <LogIn className="h-4 w-4" />
                    Confirmer le Check-in
                  </Button>
                )}
                {canCheckOut && (
                  <Button
                    className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700"
                    onClick={() => {
                      setCheckOutBooking(selectedBooking);
                      setSelectedBooking(null);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Procéder au Check-out
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {checkInBooking && <CheckInDialog booking={checkInBooking} open={!!checkInBooking} onOpenChange={(open) => !open && setCheckInBooking(null)} />}
      {checkOutBooking && getCheckoutRoom(checkOutBooking) && <CheckoutDecisionDialog booking={checkOutBooking} room={getCheckoutRoom(checkOutBooking)!} open={!!checkOutBooking} onOpenChange={(open) => !open && setCheckOutBooking(null)} />}
    </MainLayout>
  );
};

export default Planning;
