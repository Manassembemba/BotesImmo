import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Calendar, DollarSign, Users, Phone, Mail } from 'lucide-react';
import { Room } from '@/hooks/useRooms';
import { Booking } from '@/hooks/useBookings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';

interface CardViewProps {
  rooms: (Room & { isAvailableNow: boolean; daysUntilAvailable: number; nextAvailableDate: Date })[];
}

export function CardView({ rooms }: CardViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rooms.map((room) => {
        const isAvailable = room.isAvailableNow;
        const statusLabel = isAvailable ? 'Disponible' : 'Occupé';
        const statusColor = isAvailable ? 'bg-green-500 hover:bg-green-500/80' : 'bg-red-500 hover:bg-red-500/80';
        const nextAvailable = isAvailable ? 'Maintenant' : format(room.nextAvailableDate, 'dd/MM/yyyy', { locale: fr });

        return (
          <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-muted/30">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{room.type}</h3>
                  <p className="text-sm text-muted-foreground">Appartement {room.numero}</p>
                </div>
                <Badge className={statusColor}>
                  {statusLabel}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Bed className="h-4 w-4 text-muted-foreground" />
                  <span>Étage {room.etage}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{room.capacite_max} personne{room.capacite_max > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <CurrencyDisplay amountUSD={room.prix_base_nuit} showBoth={true} />
                  <span className="text-xs text-muted-foreground">/ NUIT</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Dispo: {nextAvailable}</span>
                </div>
                {/* ... (le reste du JSX reste identique) ... */}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}