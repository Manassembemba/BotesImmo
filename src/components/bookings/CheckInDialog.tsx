import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateBooking, Booking } from '@/hooks/useBookings';
import { useUpdateRoomStatus } from '@/hooks/useRooms';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LogIn, User, BedDouble, Calendar, DollarSign } from 'lucide-react';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';

interface CheckInDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInDialog({ booking, open, onOpenChange }: CheckInDialogProps) {
  const updateBooking = useUpdateBooking();
  const updateRoomStatus = useUpdateRoomStatus();

  const handleCheckIn = async () => {
    // 1. Update booking with check-in time. Status becomes CONFIRMED (which means IN_PROGRESS for us now)
    await updateBooking.mutateAsync({
      id: booking.id,
      check_in_reel: new Date().toISOString(),
      status: 'CONFIRMED', 
    });

    // 2. Update room status to OCCUPIED
    await updateRoomStatus.mutateAsync({
      id: booking.room_id,
      status: 'OCCUPIED',
    });

    onOpenChange(false);
  };

  const isLoading = updateBooking.isPending || updateRoomStatus.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Effectuer le check-in
          </DialogTitle>
          <DialogDescription>
            Confirmez l'arrivée du locataire pour une réservation existante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /> <span className="font-medium">{booking.tenants?.prenom} {booking.tenants?.nom}</span></div>
            <div className="flex items-center gap-3"><BedDouble className="h-4 w-4 text-muted-foreground" /> <span>Chambre {booking.rooms?.numero} ({booking.rooms?.type})</span></div>
            <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /> <span>{format(new Date(booking.date_debut_prevue), 'dd MMM', { locale: fr })} → {format(new Date(booking.date_fin_prevue), 'dd MMM yyyy', { locale: fr })}</span></div>
            <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-muted-foreground" /> <CurrencyDisplay amountUSD={Number(booking.prix_total)} className="font-medium" /></div>
          </div>


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Annuler</Button>
          <Button onClick={handleCheckIn} disabled={isLoading}>
            {isLoading ? 'Traitement...' : 'Confirmer le check-in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
