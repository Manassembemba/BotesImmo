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
  rooms: Room[];
  bookings: Booking[];
}

export function CardView({ rooms, bookings }: CardViewProps) {
  // Fonction pour déterminer le statut d'une chambre
  const getRoomStatus = (room: Room) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Find any booking for this room that is happening today and is not cancelled
    const activeBooking = bookings.find(b => 
      b.room_id === room.id && 
      (b.status === 'IN_PROGRESS' || b.status === 'CONFIRMED') && 
      today >= new Date(new Date(b.date_debut_prevue).setHours(0,0,0,0)) && 
      today <= new Date(new Date(b.date_fin_prevue).setHours(0,0,0,0))
    );

    if (activeBooking) {
      if (activeBooking.status === 'IN_PROGRESS') {
        return { status: 'occupied', label: 'Occupée', color: 'bg-red-100 text-red-800' };
      }
      return { status: 'booked', label: 'Réservée', color: 'bg-yellow-100 text-yellow-800' };
    }

    // Vérifier si la chambre est réservée mais pas encore commencée
    const upcomingBookings = bookings.filter(b => 
      b.room_id === room.id && 
      b.status === 'CONFIRMED' && 
      new Date(b.date_debut_prevue) > today
    );

    if (upcomingBookings.length > 0) {
      return { status: 'booked', label: 'Réservée', color: 'bg-yellow-100 text-yellow-800' };
    }

    // Statut de la chambre dans la base de données
    if (room.status === 'MAINTENANCE') {
      return { status: 'maintenance', label: 'Maintenance', color: 'bg-orange-100 text-orange-800' };
    }

    return { status: 'available', label: 'Disponible', color: 'bg-green-100 text-green-800' };
  };

  // Fonction pour obtenir la prochaine disponibilité
  const getNextAvailableDate = (room: Room) => {
    // Trouver les réservations futures pour cette chambre
    const futureBookings = bookings
      .filter(b => 
        b.room_id === room.id && 
        b.status !== 'CANCELLED' && 
        new Date(b.date_debut_prevue) > new Date()
      )
      .sort((a, b) => new Date(a.date_debut_prevue).getTime() - new Date(b.date_fin_prevue).getTime());

    if (futureBookings.length === 0) {
      return 'Maintenant';
    }

    const firstBooking = futureBookings[0];
    return format(new Date(firstBooking.date_fin_prevue), 'dd/MM/yyyy', { locale: fr });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rooms.map((room) => {
        const roomStatus = getRoomStatus(room);
        const nextAvailable = getNextAvailableDate(room);

        return (
          <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-muted/30">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{room.type}</h3>
                  <p className="text-sm text-muted-foreground">Appartement {room.numero}</p>
                </div>
                <Badge className={
                  roomStatus.status === 'available' ? 'bg-green-500 hover:bg-green-500/80' :
                  roomStatus.status === 'occupied' ? 'bg-red-500 hover:bg-red-500/80' :
                  roomStatus.status === 'booked' ? 'bg-yellow-500 hover:bg-yellow-500/80' :
                  'bg-orange-500 hover:bg-orange-500/80'
                }>
                  {roomStatus.label}
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
                  <span>Dispo: {getNextAvailableDate(room)}</span>
                </div>

                {room.equipements && room.equipements.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Équipements:</p>
                    <div className="flex flex-wrap gap-1">
                      {room.equipements.slice(0, 3).map((equipement, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {equipement}
                        </Badge>
                      ))}
                      {room.equipements.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{room.equipements.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}