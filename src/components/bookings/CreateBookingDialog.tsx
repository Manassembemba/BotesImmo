import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateBooking, useBookings, Booking } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { supabase } from '@/integrations/supabase/client';
import { useTenants, Tenant } from '@/hooks/useTenants';
import { bookingSchema, BookingFormData } from '@/lib/validationSchemas';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch";
import { Plus, UserPlus, AlertCircle, LogIn } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { differenceInCalendarDays, format, addDays, isValid } from 'date-fns';
import { CreateTenantDialog } from '../tenants/CreateTenantDialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"

interface CreateBookingDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  initialData?: {
    roomId: string;
    startDate: string;
    endDate: string;
  };
}

const statusTranslations: Record<string, string> = {
  OCCUPIED: 'Occupée',
  BOOKED: 'Réservée',
  PENDING_CHECKOUT: 'Départ imminent',
  PENDING_CLEANING: 'Nettoyage en cours',
  MAINTENANCE: 'Maintenance',
};

export function CreateBookingDialog(props: CreateBookingDialogProps) {
  const { role } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [nights, setNights] = useState(1);

  const { data: rooms = [] } = useRooms();
  const { data: bookingsResult } = useBookings();
  const bookings = bookingsResult?.data || [];
  const { data: tenants = [], refetch: refetchTenants } = useTenants();
  const createBooking = useCreateBooking();
  const { data: exchangeRateData } = useExchangeRate();

  const activeBookingsByRoomId = useMemo(() => {
    const map = new Map<string, Booking>();
    const today = new Date();

    bookings.forEach(b => {
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
  }, [bookings]);

  const isControlled = props.open !== undefined && props.onOpenChange !== undefined;
  const open = isControlled ? props.open : internalOpen;
  const onOpenChange = isControlled ? props.onOpenChange : setInternalOpen;

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    defaultValues: {
      room_id: '',
      tenant_id: '',
      date_debut_prevue: format(new Date(), 'yyyy-MM-dd'),
      date_fin_prevue: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      prix_total: 0,
      status: 'CONFIRMED',
      discount_amount: 0,
      initial_payment: 0,
    },
  });

  const { watch, setValue, reset, formState: { isValid: isFormValid } } = form;
  const roomId = watch('room_id');
  const dateDebut = watch('date_debut_prevue');
  const dateFin = watch('date_fin_prevue');
  const discountAmount = watch('discount_amount');
  const prixTotal = watch('prix_total');
  const selectedRoom = rooms.find(r => r.id === roomId);

  const [amountUSD, setAmountUSD] = useState<string | number>('');
  const [amountCDF, setAmountCDF] = useState<string | number>('');

  useEffect(() => {
    if (open && props.initialData) {
      const startDate = new Date(props.initialData.startDate);
      const endDate = new Date(props.initialData.endDate);
      const numNights = isValid(startDate) && isValid(endDate) && endDate > startDate
        ? differenceInCalendarDays(endDate, startDate)
        : 1;

      setNights(numNights);
      reset({
        room_id: props.initialData.roomId,
        date_debut_prevue: format(startDate, 'yyyy-MM-dd'),
        date_fin_prevue: format(endDate, 'yyyy-MM-dd'),
        status: props.initialData.startDate === format(new Date(), 'yyyy-MM-dd') ? 'CONFIRMED' : 'PENDING',
        tenant_id: '',
        prix_total: 0,
        discount_amount: 0,
        initial_payment: 0,
      });
    }
  }, [open, props.initialData, reset]);

  const isTodayBooking = useMemo(() => {
    return dateDebut === format(new Date(), 'yyyy-MM-dd');
  }, [dateDebut]);

  const isImmediate = isTodayBooking;

  useEffect(() => {
    if (isImmediate) {
      setValue('status', 'CONFIRMED', { shouldValidate: true });
    } else {
      setValue('status', 'PENDING', { shouldValidate: true });
    }
  }, [isImmediate, setValue]);

  useEffect(() => {
    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);

    if (isValid(startDate) && isValid(endDate) && endDate > startDate) {
      const numNights = differenceInCalendarDays(endDate, startDate);
      if (nights !== numNights) {
        setNights(numNights);
      }
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    const startDate = new Date(dateDebut);
    if (isValid(startDate) && nights > 0) {
      const calculatedEndDate = format(addDays(startDate, nights), 'yyyy-MM-dd');
      if (dateFin !== calculatedEndDate) {
        setValue('date_fin_prevue', calculatedEndDate, { shouldValidate: true });
      }
    }
  }, [nights, dateDebut, setValue]);

  useEffect(() => {
    if (selectedRoom && nights > 0) {
      const calculatedPrice = nights * selectedRoom.prix_base_nuit;
      const totalDiscount = nights * (discountAmount || 0);
      const finalPrice = Math.max(0, calculatedPrice - totalDiscount);

      if (prixTotal !== finalPrice) {
        setValue('prix_total', finalPrice, { shouldValidate: true });
      }
    }
  }, [nights, selectedRoom, discountAmount, setValue, prixTotal]);

  useEffect(() => {
    if (isImmediate && prixTotal > 0) {
      setValue('initial_payment', prixTotal);
    }
  }, [isImmediate, prixTotal, setValue]);

  const [conflictingBooking, setConflictingBooking] = useState<{ tenant_name: string; date_debut_prevue: string; date_fin_prevue: string } | null>(null);
  const [bypassConflict, setBypassConflict] = useState(false);

  useEffect(() => {
    if (!roomId || !dateDebut || !dateFin) {
      setConflictError(null);
      setConflictingBooking(null);
      setBypassConflict(false);
      return;
    }
    const handler = setTimeout(async () => {
      if (new Date(dateDebut) >= new Date(dateFin)) {
        setConflictError("La date de départ doit être après la date d'arrivée.");
        return;
      }

      const { data: conflictData, error: conflictError } = await supabase.rpc('check_booking_conflict', {
        p_room_id: roomId,
        p_start_date: new Date(dateDebut).toISOString(),
        p_end_date: new Date(dateFin).toISOString(),
      });

      if (conflictError) {
        setConflictError('Erreur lors de la vérification des conflits.');
      } else if (conflictData) {
        // Conflit détecté, récupérer les détails
        const { data: details, error: detailsError } = await supabase.rpc('get_conflicting_booking', {
          p_room_id: roomId,
          p_start_date: new Date(dateDebut).toISOString(),
          p_end_date: new Date(dateFin).toISOString(),
        });

        if (details && details.length > 0) {
          setConflictingBooking(details[0]);
          setConflictError(`Conflit détecté avec ${details[0].tenant_name}`);
        } else {
          setConflictError('Conflit détecté ! Cette chambre est déjà réservée sur cette période.');
        }
      } else {
        setConflictError(null);
        setConflictingBooking(null);
        setBypassConflict(false); // Reset bypass if no conflict
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [roomId, dateDebut, dateFin]);

  const bookableRooms = rooms.filter(r => r.status !== 'Maintenance' && r.status !== 'MAINTENANCE');

  const handleTenantCreated = async (newTenant: Tenant) => {
    await refetchTenants();
    setValue('tenant_id', newTenant.id, { shouldValidate: true });
    setIsCreatingTenant(false);
  };

  const onSubmit = async (data: BookingFormData) => {
    if (conflictError && !bypassConflict) return;
    const finalInitialPaymentUSD = Number(amountUSD);
    const finalInitialPaymentCDF = Number(amountCDF);

    try {
      await createBooking.mutateAsync({
        booking: {
          room_id: data.room_id,
          tenant_id: data.tenant_id,
          date_debut_prevue: data.date_debut_prevue,
          date_fin_prevue: data.date_fin_prevue,
          prix_total: data.prix_total,
          notes: '', // Removed notes functionality
          status: data.status || (isImmediate ? 'CONFIRMED' : 'PENDING'),
          caution_encaissee: 0,
          check_in_reel: isImmediate ? new Date().toISOString() : null,
          check_out_reel: null,
        },
        isImmediate,
        initialPaymentAmount: data.initial_payment,
        discountAmount: data.discount_amount,
        initialPaymentUSD: finalInitialPaymentUSD,
        initialPaymentUSD: finalInitialPaymentUSD,
        initialPaymentCDF: finalInitialPaymentCDF,
        bypassConflict: bypassConflict,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Booking creation failed:", error);
    }
  };

  const trigger = props.trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle Entrée</Button>;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {isImmediate ? (
                <span className="flex items-center gap-2 text-emerald-600"><LogIn className="h-5 w-5" /> Check-in Direct</span>
              ) : (
                <span className="flex items-center gap-2 text-indigo-600"><Plus className="h-5 w-5" /> Nouvelle Réservation</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {isImmediate
                ? "Enregistrez une arrivée immédiate. Le locataire sera installé dès la validation."
                : "Planifiez une réservation future. Le statut sera 'En attente' par défaut."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4 max-h-[75vh] overflow-y-auto pr-6 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <FormField control={form.control} name="room_id" render={({ field }) => (<FormItem><FormLabel>Chambre</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une chambre" /></SelectTrigger></FormControl><SelectContent>{bookableRooms.map(room => (
                  <SelectItem key={room.id} value={room.id} className="flex justify-between items-center w-full">
                    <span>Ch. {room.numero} - {room.type} ({room.prix_base_nuit}$/nuit)</span>
                    {(() => {
                      const currentActiveBooking = activeBookingsByRoomId.get(room.id);
                      const endDate = currentActiveBooking ? format(new Date(currentActiveBooking.date_fin_prevue), 'dd/MM') : '';
                      if (currentActiveBooking || room.status === 'Occupé') {
                        return (
                          <Badge variant="secondary" className="ml-2 text-[10px] h-5">
                            Occupé {endDate && `jusqu'au ${endDate}`}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </SelectItem>
                ))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="tenant_id" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Locataire</FormLabel>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? tenants.find((tenant) => tenant.id === field.value)?.prenom + ' ' + tenants.find((tenant) => tenant.id === field.value)?.nom
                                : "Rechercher un locataire..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Rechercher nom ou prénom..." />
                            <CommandList>
                              <CommandEmpty>Aucun locataire trouvé.</CommandEmpty>
                              <CommandGroup>
                                {tenants.filter(t => !t.liste_noire).map((tenant) => (
                                  <CommandItem
                                    value={tenant.prenom + ' ' + tenant.nom}
                                    key={tenant.id}
                                    onSelect={() => {
                                      form.setValue("tenant_id", tenant.id, { shouldValidate: true })
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        tenant.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {tenant.prenom} {tenant.nom}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreatingTenant(true)} title="Créer un nouveau locataire"><UserPlus className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Dates du séjour</Label>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-4 items-end">
                  <FormField control={form.control} name="date_debut_prevue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrivée</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="h-11 border-slate-200 focus:border-indigo-500"
                          min={role === 'ADMIN' ? undefined : format(new Date(), 'yyyy-MM-dd')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormItem>
                    <FormLabel>Nuits</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        value={nights}
                        className="h-11 text-center font-bold border-slate-200"
                        onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </FormControl>
                  </FormItem>

                  <FormField control={form.control} name="date_fin_prevue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Départ</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="h-11 border-slate-200 focus:border-indigo-500"
                          min={role === 'ADMIN' ? undefined : (dateDebut ? format(addDays(new Date(dateDebut), 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              {conflictError && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                    <AlertCircle className="h-4 w-4" />
                    <p>{conflictError}</p>
                  </div>
                  {conflictingBooking && (
                    <div className="mt-2 ml-6 text-sm text-destructive/80">
                      <p>Réservé par : <span className="font-semibold">{conflictingBooking.tenant_name}</span></p>
                      <p>Du : {format(new Date(conflictingBooking.date_debut_prevue), 'dd/MM/yyyy')} au {format(new Date(conflictingBooking.date_fin_prevue), 'dd/MM/yyyy')}</p>
                    </div>
                  )}
                  {role === 'ADMIN' && (
                    <div className="mt-3 flex items-center space-x-2">
                      <Checkbox
                        id="bypass"
                        checked={bypassConflict}
                        onCheckedChange={(checked) => setBypassConflict(checked as boolean)}
                        className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                      />
                      <label
                        htmlFor="bypass"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive"
                      >
                        Forcer la réservation (Ignorer le conflit)
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4 space-y-4">

                <div className="space-y-4">
                  <div className="border-t pt-6 space-y-6">
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-2xl shadow-xl border border-white/10 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-colors" />
                        <div className="relative z-10 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-1">Total du Séjour</p>
                            <p className="text-4xl font-black tracking-tight italic">
                              {prixTotal.toFixed(2)} <span className="text-xl text-indigo-300 not-italic">$</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Équivalent CDF</p>
                            <p className="text-2xl font-bold text-indigo-100">
                              {(prixTotal * (exchangeRateData?.usd_to_cdf || 2800)).toLocaleString()} <span className="text-sm">FC</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="discount" className="text-sm font-bold text-slate-600">Réduction par nuit ($)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <Input
                              id="discount"
                              type="number"
                              min="0"
                              step="1"
                              value={discountAmount}
                              className="h-11 pl-8 border-slate-200 focus:ring-indigo-500 bg-white"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val >= 0 || e.target.value === '') {
                                  setValue('discount_amount', val, { shouldValidate: true });
                                }
                              }}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <FormField control={form.control} name="initial_payment" render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-bold text-slate-600">Paiement / Acompte ($)</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value}
                                onChange={(val) => field.onChange(val)}
                                onChangeUsd={(usd) => setAmountUSD(usd)}
                                onChangeCdf={(cdf) => setAmountCDF(cdf)}
                                mode="independent"
                                labelUsd="Montant USD *"
                                labelCdf="Montant CDF *"
                                showStatusIndicator={true}
                                balanceDue={prixTotal}
                                className="bg-white border-slate-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isImmediate} // Bloqué sur CONFIRMED si direct
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">En attente</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmée</SelectItem>
                          <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                          <SelectItem value="COMPLETED">Terminée</SelectItem>
                          <SelectItem value="CANCELLED">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-6 h-12 font-bold text-slate-500 hover:text-slate-900"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createBooking.isPending || (role !== 'ADMIN' && (!isFormValid || !!conflictError)) || (role === 'ADMIN' && !isFormValid) || (role === 'ADMIN' && !!conflictError && !bypassConflict)}
                  className={cn(
                    "px-8 h-12 font-black uppercase tracking-widest shadow-lg transition-all",
                    isImmediate ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                  )}
                >
                  {createBooking.isPending ? 'Traitement...' : (isImmediate ? 'Confirmer le Check-in' : 'Valider la réservation')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <CreateTenantDialog open={isCreatingTenant} onOpenChange={setIsCreatingTenant} onTenantCreated={handleTenantCreated} />
    </>
  );
}