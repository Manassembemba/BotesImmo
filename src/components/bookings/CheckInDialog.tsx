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
import { useCheckIn, Booking } from '@/hooks/useBookings';
import { useUpdateRoomStatus } from '@/hooks/useRooms';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LogIn, User, BedDouble, Calendar, DollarSign } from 'lucide-react';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { BookingFinancialPanel } from './BookingFinancialPanel';

interface CheckInDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInDialog({ booking, open, onOpenChange }: CheckInDialogProps) {
  const checkIn = useCheckIn();
  const updateRoomStatus = useUpdateRoomStatus();
  const { toast } = useToast();

  const handleCheckIn = async () => {
    try {
      // 1. Update booking with check-in time.
      await checkIn.mutateAsync({
        id: booking.id,
        check_in_reel: new Date().toISOString(),
      });

      // 2. Update room status to OCCUPIED
      await updateRoomStatus.mutateAsync({
        id: booking.room_id,
        status: 'Occupé',
      });

      onOpenChange(false);

      toast({
        title: "Check-in confirmé",
        description: "Le locataire est bien arrivé.",
      });
    } catch (error) {
      console.error("Erreur check-in:", error);
      toast({
        variant: "destructive",
        title: "Erreur lors du check-in",
        description: "Impossible de valider l'entrée. Veuillez réessayer.",
      });
    }
  };

  const isLoading = checkIn.isPending || updateRoomStatus.isPending;

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
          </div>

          <div className="pt-2">
            <BookingFinancialPanel bookingId={booking.id} />
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
