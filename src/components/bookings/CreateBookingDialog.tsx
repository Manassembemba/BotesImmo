import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateBooking } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useTenants, Tenant } from '@/hooks/useTenants';
import { bookingSchema, BookingFormData } from '@/lib/validationSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, UserPlus, AlertCircle } from 'lucide-react';
import { differenceInDays, format, addDays, isValid } from 'date-fns';
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
  const selectedRoom = rooms.find(r => r.id === roomId);

  // Effect to handle pre-filled data from the calendar
  useEffect(() => {
    if (open && props.initialData) {
      setIsImmediate(false); // It's a future booking if it comes from the calendar
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
      // Reset to default for a normal opening
      setIsImmediate(true);
    }
  }, [open, props.initialData, reset]);


  // Effect to manage form state based on isImmediate checkbox
  useEffect(() => {
    if (isImmediate) {
      setValue('date_debut_prevue', format(new Date(), 'yyyy-MM-dd'));
      setValue('status', 'CONFIRMED');
    } else {
       // Only clear start date if not pre-filled by initialData
      if (!props.initialData) {
        setValue('date_debut_prevue', '');
      }
      setValue('status', 'PENDING');
    }
     // Reset fields when mode changes, unless pre-filled
    if (!props.initialData) {
        setValue('date_fin_prevue', '');
        setValue('prix_total', 0);
        setValue('discount_amount', 0);
        setValue('initial_payment', 0);
    }
  }, [isImmediate, setValue, props.initialData]);
  
  useEffect(() => {
    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);
    if (selectedRoom && isValid(startDate) && isValid(endDate) && endDate > startDate) {
      const numNights = differenceInDays(endDate, startDate);
      setNights(numNights);
      const calculatedPrice = numNights * selectedRoom.prix_base_nuit;
      const finalPrice = calculatedPrice - (discountAmount || 0);
      setValue('prix_total', finalPrice > 0 ? finalPrice : 0);
      
      if(isImmediate || numNights === 1) {
        setValue('initial_payment', finalPrice > 0 ? finalPrice : 0);
      } else {
        setValue('initial_payment', 0);
      }
    } else {
      setNights(0);
      setValue('prix_total', 0);
    }
  }, [selectedRoom, dateDebut, dateFin, discountAmount, isImmediate, setValue]);

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

  const bookableRooms = rooms.filter(r => isImmediate ? r.status === 'AVAILABLE' : r.status !== 'MAINTENANCE');

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
          <DialogHeader><DialogTitle>{isImmediate ? 'Check-in Direct' : 'Nouvelle Réservation'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="flex items-center space-x-2"><Checkbox id="isImmediate" checked={isImmediate} onCheckedChange={(checked) => setIsImmediate(Boolean(checked))} /><label htmlFor="isImmediate" className="text-sm font-medium">Check-in immédiat (Walk-in)</label></div>
              <FormField control={form.control} name="room_id" render={({ field }) => (<FormItem><FormLabel>Chambre *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une chambre" /></SelectTrigger></FormControl><SelectContent>{bookableRooms.map(room => (<SelectItem key={room.id} value={room.id}>                          Ch. {room.numero} - {room.type} ({room.prix_base_nuit}$/nuit)
                          {room.status !== 'AVAILABLE' && (
                            <span className="text-muted-foreground ml-2">
                              ({statusTranslations[room.status] || room.status})
                            </span>
                          )}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="tenant_id" render={({ field }) => (<FormItem><FormLabel>Locataire *</FormLabel><div className="flex gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un locataire" /></SelectTrigger></FormControl><SelectContent>{tenants.filter(t => !t.liste_noire).map(tenant => <SelectItem key={tenant.id} value={tenant.id}>{tenant.prenom} {tenant.nom}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={() => setIsCreatingTenant(true)} title="Créer un nouveau locataire"><UserPlus className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date_debut_prevue" render={({ field }) => (<FormItem><FormLabel>Date d'arrivée *</FormLabel><FormControl><Input type="date" {...field} disabled={isImmediate} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="date_fin_prevue" render={({ field }) => (<FormItem><FormLabel>Date de départ *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)}/>
              </div>
              {conflictError && <div className="flex items-center gap-2 text-sm text-destructive font-medium"><AlertCircle className="h-4 w-4" /><p>{conflictError}</p></div>}
              
              <div className="border-t pt-4 space-y-4">
                {nights > 1 && !isImmediate && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="discount_amount" render={({ field }) => (<FormItem><FormLabel>Réduction (USD)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="initial_payment" render={({ field }) => (<FormItem><FormLabel>Acompte / Paiement initial (USD)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormControl><FormMessage /></FormItem>)}/>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="prix_total" render={({ field }) => (<FormItem><FormLabel>Prix Total Final (USD) *</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} readOnly className="font-bold" /></FormControl><FormMessage /></FormItem>)}/>
  
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
