import { useState } from 'react';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoomTypeLabel } from '@/lib/roomUtils';
import { Room } from '@/hooks/useRooms';
import { Booking } from '@/hooks/useBookings';
import { CheckoutDecisionDialog } from '@/components/checkout/CheckoutDecisionDialog';

interface PendingCheckoutsProps {
  rooms: Room[];
  bookings: Booking[];
}

export function PendingCheckouts({ rooms, bookings }: PendingCheckoutsProps) {
  const [selectedCheckout, setSelectedCheckout] = useState<{ room: Room; booking: Booking } | null>(null);
  
  const pendingRooms = rooms.filter(room => room.status === 'PENDING_CHECKOUT');

  if (pendingRooms.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-status-pending-checkout" />
          Départs en attente
        </h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun départ en attente de validation
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-status-pending-checkout animate-pulse-soft" />
          Départs en attente
          <span className="ml-auto text-sm font-normal px-2 py-0.5 rounded-full bg-status-pending-checkout-bg text-status-pending-checkout">
            {pendingRooms.length}
          </span>
        </h3>
        <div className="space-y-3">
          {pendingRooms.map((room) => {
            // Find the active booking for this room
            const booking = bookings.find(
              b => b.room_id === room.id && 
              (b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'IN_PROGRESS')
            );

            return (
              <div 
                key={room.id} 
                className="flex items-center gap-4 p-3 rounded-lg bg-status-pending-checkout-bg/50 border border-status-pending-checkout/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Chambre {room.numero}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {getRoomTypeLabel(room.type)}
                    </span>
                  </div>
                  {booking?.tenants && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {booking.tenants.prenom} {booking.tenants.nom}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Départ prévu : {booking ? new Date(booking.date_fin_prevue).toLocaleDateString('fr-FR') : 'Non défini'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="gap-1"
                  onClick={() => booking && setSelectedCheckout({ room, booking })}
                  disabled={!booking}
                >
                  Action
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCheckout && (
        <CheckoutDecisionDialog
          open={!!selectedCheckout}
          onOpenChange={(open) => !open && setSelectedCheckout(null)}
          room={selectedCheckout.room}
          booking={selectedCheckout.booking}
        />
      )}
    </>
  );
}
