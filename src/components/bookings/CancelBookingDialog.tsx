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
import { Booking, useUpdateBooking } from '@/hooks/useBookings';
import { useUpdateRoomStatus } from '@/hooks/useRooms';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface CancelBookingDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelBookingDialog({ booking, open, onOpenChange }: CancelBookingDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const updateBooking = useUpdateBooking();
  const updateRoomStatus = useUpdateRoomStatus();

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      // Update booking status to CANCELLED
      await updateBooking.mutateAsync({
        id: booking.id,
        status: 'CANCELLED',
      });

      // If room was booked for this reservation, make it available again
      if (booking.status === 'CONFIRMED' || booking.status === 'PENDING') {
        await updateRoomStatus.mutateAsync({
          id: booking.room_id,
          status: 'AVAILABLE',
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Cancel error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Annuler la réservation
          </DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir annuler cette réservation ?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <p className="font-medium">
              {booking.tenants?.prenom} {booking.tenants?.nom}
            </p>
            <p className="text-sm text-muted-foreground">
              Appartement {booking.rooms?.numero} • {booking.rooms?.type}
            </p>
            <p className="text-sm text-muted-foreground">
              Du {new Date(booking.date_debut_prevue).toLocaleDateString('fr-FR')} au {new Date(booking.date_fin_prevue).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Cette action rendra l'appartement disponible pour de nouvelles réservations.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Retour
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Annulation...
              </>
            ) : (
              'Confirmer l\'annulation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
