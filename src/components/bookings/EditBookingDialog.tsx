import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Booking, useUpdateBooking, useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { useRooms, Room } from '@/hooks/useRooms';
import { useTenants, Tenant } from '@/hooks/useTenants';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Edit, User, BedDouble, AlertCircle, AlertTriangle, UserPlus, Check, ChevronsUpDown, Shield, Clock } from 'lucide-react';
import { differenceInCalendarDays, format, addDays, isValid, parseISO } from 'date-fns';
import { BookingFinancialPanel } from './BookingFinancialPanel';
import { CreateTenantDialog } from '../tenants/CreateTenantDialog';
import { cn } from '@/lib/utils';

const editBookingSchema = z.object({
  room_id: z.string().min(1, 'Chambre requise'),
  tenant_id: z.string().min(1, 'Locataire requis'),
  date_debut_prevue: z.string().min(1, "Date d'arrivée requise"),
  date_fin_prevue: z.string().min(1, 'Date de départ requise'),
  prix_total: z.number().min(0, 'Prix total invalide'),
  discount_amount: z.number().min(0).optional(),
  caution_encaissee: z.number().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Statut invalide' })
  }),
  check_in_reel: z.string().optional().nullable(),
  check_out_reel: z.string().optional().nullable(),
});

type EditBookingFormData = z.infer<typeof editBookingSchema>;

interface EditBookingDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBookingDialog({ booking, open, onOpenChange }: EditBookingDialogProps) {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const updateBooking = useUpdateBooking();

  const { data: rooms = [] } = useRooms();
  const { data: allBookingsData } = useBookings();
  const allBookings = allBookingsData?.data || [];
  const { data: tenants = [], refetch: refetchTenants } = useTenants();
  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;

  const [conflictError, setConflictError] = useState<string | null>(null);
  const [bypassConflict, setBypassConflict] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [nights, setNights] = useState(1);

  // Mapping des réservations actives par chambre (excluant la réservation en cours d'édition)
  const activeBookingsByRoomId = useMemo(() => {
    const map = new Map<string, Booking>();
    const today = new Date();

    allBookings.forEach((b) => {
      if (b.id === booking.id) return; // Ne pas compter la réservation actuelle
      const startDate = new Date(b.date_debut_prevue);
      const endDate = new Date(b.date_fin_prevue);

      if (
        (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') &&
        startDate <= today && today <= endDate
      ) {
        map.set(b.room_id, b);
      }
    });
    return map;
  }, [allBookings, booking.id]);

  const getRoomStatusDetails = (room: Room) => {
    const activeBooking = activeBookingsByRoomId.get(room.id);
    const isOccupied = room.status === 'Occupé' || (room.status as string) === 'OCCUPIED' || !!activeBooking;

    if (isOccupied) {
      const endDate = activeBooking ? format(new Date(activeBooking.date_fin_prevue), 'dd/MM') : '';
      return {
        label: endDate ? `Occupé (jusqu'au ${endDate})` : 'Occupé',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (room.status === 'Maintenance' || (room.status as string) === 'MAINTENANCE') {
      return {
        label: 'En maintenance',
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    }
    if (room.status === 'PENDING_CHECKOUT') {
      return {
        label: 'Départ imminent',
        className: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    }
    if (room.status === 'BOOKED') {
      return {
        label: 'Réservé',
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    }
    if (room.status === 'PENDING_CLEANING' || room.status === 'Nettoyage' || room.status === 'A_NETTOYER') {
      return {
        label: 'À nettoyer',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: 'Disponible',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  // Helper pour formater une date en YYYY-MM-DD
  const formatDateToInput = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const formatDateToTimeInput = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return '';
    }
  };

  const form = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    mode: 'onChange',
    defaultValues: {
      room_id: '',
      tenant_id: '',
      date_debut_prevue: '',
      date_fin_prevue: '',
      prix_total: 0,
      discount_amount: 0,
      caution_encaissee: 0,
      notes: '',
      status: 'CONFIRMED',
      check_in_reel: '',
      check_out_reel: '',
    },
  });

  const { watch, setValue, reset, getValues } = form;
  const watchedRoomId = watch('room_id');
  const watchedTenantId = watch('tenant_id');
  const dateDebut = watch('date_debut_prevue');
  const dateFin = watch('date_fin_prevue');
  const discountAmount = watch('discount_amount') || 0;
  const prixTotal = watch('prix_total');

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === watchedRoomId);
  }, [rooms, watchedRoomId]);

  const selectedTenant = useMemo(() => {
    return tenants.find(t => t.id === watchedTenantId);
  }, [tenants, watchedTenantId]);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (booking && open) {
      const start = new Date(booking.date_debut_prevue);
      const end = new Date(booking.date_fin_prevue);
      const initialNights = isValid(start) && isValid(end) && end > start
        ? differenceInCalendarDays(end, start)
        : 1;

      setNights(initialNights);
      setIsManualPrice(false);
      setBypassConflict(false);
      setConflictError(null);

      // Calcul de la remise par nuit d'origine si présente
      const room = rooms.find(r => r.id === booking.room_id);
      const baseRoomPrice = room?.prix_base_nuit || 0;
      let calculatedDiscount = 0;
      if (baseRoomPrice > 0 && initialNights > 0) {
        const grossTotal = baseRoomPrice * initialNights;
        if (grossTotal > booking.prix_total) {
          calculatedDiscount = (grossTotal - booking.prix_total) / initialNights;
        }
      }

      reset({
        room_id: booking.room_id || '',
        tenant_id: booking.tenant_id || '',
        date_debut_prevue: formatDateToInput(booking.date_debut_prevue),
        date_fin_prevue: formatDateToInput(booking.date_fin_prevue),
        prix_total: Number(booking.prix_total) || 0,
        discount_amount: Math.max(0, calculatedDiscount),
        caution_encaissee: Number(booking.caution_encaissee) || 0,
        notes: booking.notes || '',
        status: (booking.status || 'CONFIRMED') as any,
        check_in_reel: formatDateToTimeInput(booking.check_in_reel),
        check_out_reel: formatDateToTimeInput(booking.check_out_reel),
      });
    }
  }, [booking, open, rooms, reset]);

  // Synchronisation des nuits quand les dates changent
  useEffect(() => {
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    if (isValid(start) && isValid(end) && end > start) {
      const diff = differenceInCalendarDays(end, start);
      if (diff !== nights) {
        setNights(diff);
      }
    }
  }, [dateDebut, dateFin, nights]);

  // Synchronisation de la date de fin quand les nuits changent
  const handleNightsChange = (newNights: number) => {
    const validNights = Math.max(1, newNights);
    setNights(validNights);
    const start = new Date(dateDebut);
    if (isValid(start)) {
      const newEndDate = format(addDays(start, validNights), 'yyyy-MM-dd');
      setValue('date_fin_prevue', newEndDate, { shouldValidate: true });
    }
  };

  // Recalcul automatique du prix si mode automatique
  useEffect(() => {
    if (!isManualPrice && selectedRoom && nights > 0) {
      const baseTotal = nights * selectedRoom.prix_base_nuit;
      const totalDiscount = nights * discountAmount;
      const calculated = Math.max(0, baseTotal - totalDiscount);
      if (prixTotal !== calculated) {
        setValue('prix_total', calculated, { shouldValidate: true });
      }
    }
  }, [isManualPrice, selectedRoom, nights, discountAmount, setValue, prixTotal]);

  // Détection de conflit temps réel (en excluant la réservation actuelle)
  useEffect(() => {
    if (!watchedRoomId || !dateDebut || !dateFin) {
      setConflictError(null);
      setBypassConflict(false);
      return;
    }

    const handler = setTimeout(async () => {
      const start = new Date(dateDebut);
      const end = new Date(dateFin);

      if (start >= end) {
        setConflictError("La date de départ doit être postérieure à la date d'arrivée.");
        return;
      }

      const { data: hasConflict, error } = await supabase.rpc('check_booking_conflict', {
        p_room_id: watchedRoomId,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_booking_id_to_exclude: booking.id,
      });

      if (error) {
        console.error('Erreur vérification conflit:', error);
        setConflictError('Erreur lors de la vérification des disponibilités.');
      } else if (hasConflict) {
        setConflictError('Conflit détecté ! Cette chambre est déjà réservée par un autre client sur cette période.');
      } else {
        setConflictError(null);
        setBypassConflict(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [watchedRoomId, dateDebut, dateFin, booking.id]);

  const handleTenantCreated = async (newTenant: Tenant) => {
    await refetchTenants();
    setValue('tenant_id', newTenant.id, { shouldValidate: true });
    setIsCreatingTenant(false);
  };

  const onSubmit = async (data: EditBookingFormData) => {
    if (conflictError && !bypassConflict) return;

    try {
      const startDate = new Date(data.date_debut_prevue);
      const endDate = new Date(data.date_fin_prevue);

      if (startDate >= endDate) {
        form.setError('date_fin_prevue', {
          message: "La date de départ doit être après la date d'arrivée",
        });
        return;
      }

      await updateBooking.mutateAsync({
        id: booking.id,
        room_id: data.room_id,
        tenant_id: data.tenant_id,
        date_debut_prevue: startDate.toISOString(),
        date_fin_prevue: endDate.toISOString(),
        prix_total: Number(data.prix_total),
        notes: data.notes || '',
        status: data.status,
        caution_encaissee: Number(data.caution_encaissee) || 0,
        check_in_reel: data.check_in_reel ? new Date(data.check_in_reel).toISOString() : null,
        check_out_reel: data.check_out_reel ? new Date(data.check_out_reel).toISOString() : null,
        discount_amount: data.discount_amount || 0,
        bypassConflict: bypassConflict,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réservation:', error);
    }
  };

  if (!booking) return null;

  const bookableRooms = rooms.filter(r => r.status !== 'Maintenance' && r.status !== 'MAINTENANCE');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[92dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <Edit className="h-5 w-5 text-indigo-600" />
              Modifier la réservation
              {isAdmin && (
                <Badge variant="outline" className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 text-xs">
                  <Shield className="h-3 w-3" /> Mode Admin Total
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Ajustez l'ensemble des paramètres du séjour, de la chambre, du locataire et de la tarification.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto pr-2 space-y-6 flex-1 py-4 scrollbar-thin">
            {/* Résumé financier de la réservation */}
            <BookingFinancialPanel bookingId={booking.id} />

            <Form {...form}>
              <form id="edit-booking-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* 1. Chambre & Locataire */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  {/* Sélecteur de chambre */}
                  <FormField
                    control={form.control}
                    name="room_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 font-bold text-slate-700">
                          <BedDouble className="h-4 w-4 text-indigo-600" /> Appartement / Chambre
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Sélectionner une chambre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-64">
                            {bookableRooms.map(room => {
                              const statusDetails = getRoomStatusDetails(room);
                              return (
                                <SelectItem key={room.id} value={room.id}>
                                  <div className="flex items-center justify-between w-full gap-3 py-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">App. {room.numero}</span>
                                      <span className="text-muted-foreground text-xs font-normal">
                                        ({room.type} • {room.prix_base_nuit}$/n)
                                      </span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn("text-[10px] h-5 font-semibold px-2 border", statusDetails.className)}
                                    >
                                      {statusDetails.label}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        {/* Aperçu du statut de la chambre sélectionnée */}
                        {selectedRoom && (
                          <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 mt-1.5 shadow-2xs">
                            <span className="text-slate-500 font-medium">Statut actuel :</span>
                            {(() => {
                              const details = getRoomStatusDetails(selectedRoom);
                              return (
                                <Badge variant="outline" className={cn("text-[11px] font-bold px-2 py-0.5 border", details.className)}>
                                  {details.label}
                                </Badge>
                              );
                            })()}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sélecteur de locataire */}
                  <FormField
                    control={form.control}
                    name="tenant_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-1.5 font-bold text-slate-700">
                          <User className="h-4 w-4 text-indigo-600" /> Locataire / Client
                        </FormLabel>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between bg-white text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value && selectedTenant
                                    ? `${selectedTenant.prenom} ${selectedTenant.nom?.toUpperCase()}`
                                    : "Rechercher un locataire..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Rechercher nom, prénom..." />
                                <CommandList>
                                  <CommandEmpty>Aucun locataire trouvé.</CommandEmpty>
                                  <CommandGroup>
                                    {tenants.map(t => (
                                      <CommandItem
                                        key={t.id}
                                        value={`${t.prenom} ${t.nom}`}
                                        onSelect={() => {
                                          form.setValue("tenant_id", t.id, { shouldValidate: true });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            t.id === field.value ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {t.prenom} {t.nom}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsCreatingTenant(true)}
                            title="Créer un nouveau locataire"
                            className="shrink-0 bg-white"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 2. Dates du séjour */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Période & Nuitées
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="date_debut_prevue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'arrivée</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Nuits</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          value={nights}
                          className="h-11 text-center font-bold"
                          onChange={(e) => handleNightsChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                    </FormItem>

                    <FormField
                      control={form.control}
                      name="date_fin_prevue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de départ</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Bannière de Conflit */}
                {conflictError && (
                  <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl space-y-3 animate-in fade-in shadow-sm">
                    <div className="flex items-start gap-2.5 text-amber-900 font-semibold text-sm">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <span>{conflictError}</span>
                    </div>
                    <div className="pt-2 border-t border-amber-200">
                      <label
                        htmlFor="bypassConflictEdit"
                        className="flex items-center gap-3 p-2 rounded-lg bg-amber-100/70 hover:bg-amber-100 transition-colors cursor-pointer select-none"
                      >
                        <Checkbox
                          id="bypassConflictEdit"
                          checked={bypassConflict}
                          onCheckedChange={(checked) => setBypassConflict(!!checked)}
                          className="h-5 w-5 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 border-amber-400"
                        />
                        <span className="text-xs sm:text-sm font-bold text-amber-950">
                          Forcer la réservation (passer outre le conflit de disponibilité)
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 3. Tarification & Prix */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-5 rounded-2xl shadow-md border border-white/10 text-white space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Total du Séjour</p>
                      <p className="text-3xl font-black tracking-tight">
                        {Number(prixTotal || 0).toFixed(2)} <span className="text-lg text-indigo-300 font-normal">$</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Équivalent CDF</p>
                      <p className="text-xl font-bold text-indigo-200">
                        {((Number(prixTotal) || 0) * rate).toLocaleString()} <span className="text-xs font-normal">FC</span>
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-indigo-200">Saisie manuelle du prix total</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isManualPrice}
                          onCheckedChange={setIsManualPrice}
                          id="manual-price-toggle"
                        />
                        <Label htmlFor="manual-price-toggle" className="text-xs cursor-pointer text-slate-300">
                          {isManualPrice ? 'Prix personnalisé actif' : 'Calcul automatique'}
                        </Label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Réduction par nuit */}
                  <FormField
                    control={form.control}
                    name="discount_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700">Réduction par nuit ($)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={field.value || 0}
                              disabled={isManualPrice}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              className="pl-8 bg-white"
                              placeholder="0.00"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Prix total direct si manuel */}
                  {isManualPrice ? (
                    <FormField
                      control={form.control}
                      name="prix_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-indigo-600">Prix total forcé ($)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={field.value || 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="pl-8 bg-white font-bold text-indigo-600 border-indigo-300"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="caution_encaissee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-700">Caution / Dépôt ($)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={field.value || 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="pl-8 bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* 4. Statut & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700">Statut de la réservation</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="bg-white font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">En attente (PENDING)</SelectItem>
                              <SelectItem value="CONFIRMED">Confirmée (CONFIRMED)</SelectItem>
                              <SelectItem value="IN_PROGRESS">En cours (IN_PROGRESS)</SelectItem>
                              <SelectItem value="COMPLETED">Terminée (COMPLETED)</SelectItem>
                              <SelectItem value="CANCELLED">Annulée (CANCELLED)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isManualPrice && (
                    <FormField
                      control={form.control}
                      name="caution_encaissee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-700">Caution / Dépôt ($)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={field.value || 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="pl-8 bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-700">Notes / Remarques du séjour</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="Demandes particulières, heure d'arrivée souhaitée, commentaires..."
                          className="bg-white resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 5. Section Avancée Admin : Horodatages réels */}
                {isAdmin && (
                  <div className="bg-slate-100/70 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      Horodatages réels (Audit Admin)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="check_in_reel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-slate-600">Check-in Réel</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value || ''}
                                className="h-9 bg-white text-xs"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="check_out_reel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-slate-600">Check-out Réel</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value || ''}
                                className="h-9 bg-white text-xs"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={updateBooking.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="edit-booking-form"
              disabled={updateBooking.isPending || (!!conflictError && !bypassConflict)}
              className={cn(
                "px-6 font-bold shadow-md transition-all",
                bypassConflict
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
              )}
            >
              {updateBooking.isPending
                ? 'Enregistrement...'
                : bypassConflict
                ? 'Forcer & Enregistrer'
                : 'Enregistrer les modifications'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateTenantDialog
        open={isCreatingTenant}
        onOpenChange={setIsCreatingTenant}
        onTenantCreated={handleTenantCreated}
      />
    </>
  );
}