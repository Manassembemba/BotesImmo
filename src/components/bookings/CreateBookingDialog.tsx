import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateBooking } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useTenants, Tenant } from '@/hooks/useTenants';
import { bookingSchema, BookingFormData } from '@/lib/validationSchemas';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, UserPlus, AlertCircle } from 'lucide-react';
import { differenceInCalendarDays, format, addDays, isValid } from 'date-fns';
import { CreateTenantDialog } from '../tenants/CreateTenantDialog';
import { supabase } from '@/integrations/supabase/client';

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
  const [internalOpen, setInternalOpen] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isImmediate, setIsImmediate] = useState(true);
  const [nights, setNights] = useState(1);
  const [isPaidInFull, setIsPaidInFull] = useState(true); // New state for the checkbox

  const { data: rooms = [] } = useRooms();
  const { data: tenants = [], refetch: refetchTenants } = useTenants();
  const createBooking = useCreateBooking();

  const isControlled = props.open !== undefined && props.onOpenChange !== undefined;
  const open = isControlled ? props.open : internalOpen;
  const onOpenChange = isControlled ? props.onOpenChange : setInternalOpen;
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      room_id: '',
      tenant_id: '',
      date_debut_prevue: format(new Date(), 'yyyy-MM-dd'),
      date_fin_prevue: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      prix_total: 0,
      notes: '',
      status: 'CONFIRMED',
      discount_amount: 0,
      initial_payment: 0,
    },
  });

  const { watch, setValue, reset } = form;
  const roomId = watch('room_id');
  const dateDebut = watch('date_debut_prevue');
  const dateFin = watch('date_fin_prevue');
  const discountAmount = watch('discount_amount');
  const prixTotal = watch('prix_total'); // Watch prix_total
  const selectedRoom = rooms.find(r => r.id === roomId);

  // Effect to handle pre-filled data from the calendar
  useEffect(() => {
    if (open && props.initialData) {
      setIsImmediate(false); 
      reset({
        room_id: props.initialData.roomId,
        date_debut_prevue: format(new Date(props.initialData.startDate), 'yyyy-MM-dd'),
        date_fin_prevue: format(new Date(props.initialData.endDate), 'yyyy-MM-dd'),
        status: 'PENDING',
        tenant_id: '',
        prix_total: 0,
        notes: '',
        discount_amount: 0,
        initial_payment: 0,
      });
    } else if (open && !props.initialData) {
      setIsImmediate(true);
    }
  }, [open, props.initialData, reset]);


  // Effect to manage form state based on isImmediate checkbox
  useEffect(() => {
    if (isImmediate) {
      setValue('date_debut_prevue', format(new Date(), 'yyyy-MM-dd'));
      setValue('status', 'CONFIRMED');
      setIsPaidInFull(true); // Default to paid in full for walk-ins
    } else {
      if (!props.initialData) {
        setValue('date_debut_prevue', '');
      }
      setValue('status', 'PENDING');
      setIsPaidInFull(false); // Default to partial payment for future bookings
    }
    if (!props.initialData) {
        setValue('date_fin_prevue', '');
        setValue('prix_total', 0);
        setValue('discount_amount', 0);
        setValue('initial_payment', 0);
    }
  }, [isImmediate, setValue, props.initialData]);
  
  // Combined effect for all date/night/price logic
  useEffect(() => {
    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);

    // This branch handles calculation when both dates are valid. It's the primary source of truth.
    if (selectedRoom && isValid(startDate) && isValid(endDate) && endDate > startDate) {
      const numNights = differenceInCalendarDays(endDate, startDate);
      if (nights !== numNights) {
        setNights(numNights);
      }
      const calculatedPrice = numNights * selectedRoom.prix_base_nuit;
      const totalDiscount = numNights * (discountAmount || 0);
      const finalPrice = calculatedPrice - totalDiscount;
      if (prixTotal !== finalPrice) {
        setValue('prix_total', finalPrice > 0 ? finalPrice : 0);
      }
    } 
    // This branch handles calculation when the user updates the 'nights' input.
    else if (isValid(startDate) && nights > 0) {
      const calculatedEndDate = format(addDays(startDate, nights), 'yyyy-MM-dd');
      // Only set the value if it's different to prevent a loop.
      if (dateFin !== calculatedEndDate) {
        setValue('date_fin_prevue', calculatedEndDate, { shouldValidate: true });
      }
    } 
    // This is a fallback to reset if dates/nights are invalid.
    else {
      if (nights !== 0) setNights(0);
      if (prixTotal !== 0) setValue('prix_total', 0);
    }
  }, [dateDebut, dateFin, nights, selectedRoom, discountAmount, setValue, prixTotal]);

  // New effect for handling initial payment based on isPaidInFull
  useEffect(() => {
    if (isPaidInFull) {
      setValue('initial_payment', prixTotal);
    } else {
      // Optional: reset to 0 when unchecked, or leave it as is for manual entry
      setValue('initial_payment', 0); 
    }
  }, [isPaidInFull, prixTotal, setValue]);

  useEffect(() => {
    if (!roomId || !dateDebut || !dateFin) {
      setConflictError(null);
      return;
    }
    const handler = setTimeout(async () => {
      if (new Date(dateDebut) >= new Date(dateFin)) {
        setConflictError("La date de départ doit être après la date d'arrivée.");
        return;
      }
      const { data, error } = await supabase.rpc('check_booking_conflict', {
        p_room_id: roomId,
        p_start_date: new Date(dateDebut).toISOString(),
        p_end_date: new Date(dateFin).toISOString(),
      });
      if (error) setConflictError('Erreur lors de la vérification des conflits.');
      else if (data) setConflictError('Conflit détecté ! Cette chambre est déjà réservée sur cette période.');
      else setConflictError(null);
    }, 500);
    return () => clearTimeout(handler);
  }, [roomId, dateDebut, dateFin]);

  const bookableRooms = rooms.filter(r => isImmediate ? r.status === 'Libre' : r.status !== 'Maintenance');

  const handleTenantCreated = async (newTenant: Tenant) => {
    await refetchTenants();
    setValue('tenant_id', newTenant.id, { shouldValidate: true });
    setIsCreatingTenant(false);
  };

  const onSubmit = async (data: BookingFormData) => {
    if (conflictError) return;
    await createBooking.mutateAsync({
      booking: data,
      isImmediate,
      initialPaymentAmount: data.initial_payment,
      discountAmount: data.discount_amount,
    });
    onOpenChange(false);
  };
  
  const trigger = props.trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle Entrée</Button>;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isImmediate ? 'Check-in Direct' : 'Nouvelle Réservation'}</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer une réservation future ou enregistrer un check-in immédiat.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="flex items-center space-x-2"><Checkbox id="isImmediate" checked={isImmediate} onCheckedChange={(checked) => setIsImmediate(Boolean(checked))} /><label htmlFor="isImmediate" className="text-sm font-medium">Check-in immédiat (Walk-in)</label></div>
              <FormField control={form.control} name="room_id" render={({ field }) => (<FormItem><FormLabel>Chambre *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une chambre" /></SelectTrigger></FormControl><SelectContent>{bookableRooms.map(room => (<SelectItem key={room.id} value={room.id}>                          Ch. {room.numero} - {room.type} ({room.prix_base_nuit}$/nuit)
{room.status !== 'Libre' && (
                            <Badge variant="secondary" className="ml-2">{room.status}</Badge>
                          )}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="tenant_id" render={({ field }) => (<FormItem><FormLabel>Locataire *</FormLabel><div className="flex gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un locataire" /></SelectTrigger></FormControl><SelectContent>{tenants.filter(t => !t.liste_noire).map(tenant => <SelectItem key={tenant.id} value={tenant.id}>{tenant.prenom} {tenant.nom}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={() => setIsCreatingTenant(true)} title="Créer un nouveau locataire"><UserPlus className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)}/>
                            <div className="grid grid-cols-3 gap-4">
                              <FormField control={form.control} name="date_debut_prevue" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date d'arrivée *</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} disabled={isImmediate} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}/>
                              {/* New nights input field */}
                              <FormItem>
                                <FormLabel>Nuits</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={nights}
                                    onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                                    disabled={isImmediate} // Disable if immediate check-in
                                  />
                                </FormControl>
                              </FormItem>
                              <FormField control={form.control} name="date_fin_prevue" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date de départ *</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}/>
                            </div>
              {conflictError && <div className="flex items-center gap-2 text-sm text-destructive font-medium"><AlertCircle className="h-4 w-4" /><p>{conflictError}</p></div>}
              
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="prix_total" render={({ field }) => (<FormItem><FormLabel>Prix Total Final (USD) *</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} readOnly className="font-bold" /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="discount_amount" render={({ field }) => (<FormItem><FormLabel>Réduction par nuit (USD)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormControl><FormMessage /></FormItem>)}/>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="isPaidInFull" checked={isPaidInFull} onCheckedChange={(checked) => setIsPaidInFull(Boolean(checked))} />
                        <label htmlFor="isPaidInFull" className="text-sm font-medium">Totalité soldée</label>
                    </div>
                    <FormField control={form.control} name="initial_payment" render={({ field }) => (<FormItem><FormLabel>Acompte / Paiement initial (USD)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} placeholder="0.00" disabled={isPaidInFull} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
              </div>


              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Informations complémentaires..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>)}/>
              <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={createBooking.isPending || !!conflictError || !selectedRoom}>{createBooking.isPending ? 'Traitement...' : (isImmediate ? 'Confirmer le Check-in' : 'Créer la réservation')}</Button></div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <CreateTenantDialog open={isCreatingTenant} onOpenChange={setIsCreatingTenant} onTenantCreated={handleTenantCreated} />
    </>
  );
}
