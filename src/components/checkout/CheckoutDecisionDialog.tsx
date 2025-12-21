import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogOut, CalendarPlus, Calculator, Loader2 } from 'lucide-react';
import { Booking, useUpdateBooking, useExtendStay } from '@/hooks/useBookings';
import { Room, useUpdateRoomStatus } from '@/hooks/useRooms';
import { useCreateTask } from '@/hooks/useTasks';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format } from 'date-fns';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';

interface CheckoutDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  room: Room;
}

type DecisionMode = 'choice' | 'extend';

export function CheckoutDecisionDialog({ open, onOpenChange, booking, room }: CheckoutDecisionDialogProps) {
  const [mode, setMode] = useState<DecisionMode>('choice');
  const [newEndDate, setNewEndDate] = useState(booking.date_fin_prevue.split('T')[0]);
  const [newPrice, setNewPrice] = useState(booking.prix_total.toString());
  
  const { toast } = useToast();
  const updateBooking = useUpdateBooking();
  const updateRoomStatus = useUpdateRoomStatus();
  const createTask = useCreateTask();
  const extendStay = useExtendStay();

  const isProcessing = updateBooking.isPending || updateRoomStatus.isPending || createTask.isPending || extendStay.isPending;

  const calculatedPrice = useMemo(() => {
    const originalEndDate = new Date(booking.date_fin_prevue);
    const extendedEndDate = new Date(newEndDate);
    if (!isValid(extendedEndDate)) return booking.prix_total;
    
    const extraDays = differenceInDays(extendedEndDate, originalEndDate);
    
    if (extraDays <= 0) return booking.prix_total;
    
    const extraCost = extraDays * room.prix_base_nuit;
    return booking.prix_total + extraCost;
  }, [newEndDate, booking, room]);

  const handleConfirmDeparture = async () => {
    try {
      await updateBooking.mutateAsync({ id: booking.id, status: 'COMPLETED', check_out_reel: new Date().toISOString() });
      await updateRoomStatus.mutateAsync({ id: room.id, status: 'PENDING_CLEANING' });
      await createTask.mutateAsync({
        room_id: room.id,
        type_tache: 'NETTOYAGE',
        description: `Nettoyage après départ - Chambre ${room.numero}`,
        status_tache: 'TO_DO',
        date_creation: new Date().toISOString(),
      });
      toast({ title: 'Départ confirmé', description: `Le départ a été confirmé. Une tâche de nettoyage a été créée.` });
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Une erreur est survenue.' });
    }
  };

  const handleExtendStay = async () => {
    const extendedEndDate = new Date(newEndDate);
    const originalEndDate = new Date(booking.date_fin_prevue);

    if (extendedEndDate <= originalEndDate) {
      toast({ variant: 'destructive', title: 'Date invalide', description: 'La nouvelle date doit être après la date de fin actuelle.' });
      return;
    }

    await extendStay.mutateAsync({
      bookingId: booking.id,
      newEndDate: newEndDate,
      newPrice: parseFloat(newPrice),
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const resetAndClose = (open: boolean) => {
    if (!open) {
      setMode('choice');
      setNewEndDate(booking.date_fin_prevue.split('T')[0]);
      setNewPrice(booking.prix_total.toString());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chambre {room.numero} - Check-out</DialogTitle>
          <DialogDescription>{booking.tenants?.prenom} {booking.tenants?.nom} • Fin prévue: {format(new Date(booking.date_fin_prevue), 'dd/MM/yyyy')}</DialogDescription>
        </DialogHeader>

        {mode === 'choice' ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground text-center">Que souhaitez-vous faire ?</p>
            <div className="grid gap-3">
              <Button variant="default" size="lg" className="w-full justify-start gap-3 h-auto py-4" onClick={handleConfirmDeparture} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}<div className="text-left"><div className="font-semibold">Confirmer le départ</div><div className="text-xs text-primary-foreground/70">Clôturer le séjour et créer la tâche de nettoyage.</div></div></Button>
              <Button variant="outline" size="lg" className="w-full justify-start gap-3 h-auto py-4" onClick={() => setMode('extend')} disabled={isProcessing}><CalendarPlus className="h-5 w-5" /><div className="text-left"><div className="font-semibold">Prolonger le séjour</div><div className="text-xs text-muted-foreground">Choisir une nouvelle date de fin.</div></div></Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label htmlFor="newEndDate">Nouvelle date de fin</Label><Input id="newEndDate" type="date" value={newEndDate} min={booking.date_fin_prevue.split('T')[0]} onChange={(e) => setNewEndDate(e.target.value)} /></div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="newPrice">Nouveau prix total ($)</Label>
              <div className="flex gap-2">
                <Input id="newPrice" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                <Button type="button" variant="secondary" size="icon" onClick={() => setNewPrice(calculatedPrice.toFixed(2))} title="Calculer automatiquement"><Calculator className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1"><p>Prix suggéré: <CurrencyDisplay amountUSD={calculatedPrice} /></p><p>Tarif nuit: <CurrencyDisplay amountUSD={room.prix_base_nuit} /></p></div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setMode('choice')} disabled={isProcessing}>Retour</Button>
              <Button className="flex-1" onClick={handleExtendStay} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirmer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
function isValid(extendedEndDate: Date) {
    return extendedEndDate instanceof Date && !isNaN(extendedEndDate.getTime());
}
