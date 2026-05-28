import { getStatusLabel, getStatusColor, RoomStatus } from '@/lib/roomUtils';
import { cn } from '@/lib/utils';
import { Room } from '@/hooks/useRooms';

interface RoomStatusOverviewProps {
  rooms: Room[];
}

export function RoomStatusOverview({ rooms }: RoomStatusOverviewProps) {
  const statusCounts = rooms.reduce((acc, room) => {
    let status = room.status;
    // Normalisation stricte sur 3 statuts pour l'utilisateur
    if (['Libre', 'Nettoyage', 'A_NETTOYER', 'PENDING_CLEANING'].includes(status)) {
      status = 'Libre';
    } else if (['Occupé', 'PENDING_CHECKOUT', 'Maintenance', 'MAINTENANCE'].includes(status)) {
      status = 'Occupé';
    } else if (status === 'BOOKED') {
      status = 'BOOKED';
    }
    
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statuses: RoomStatus[] = ['Libre', 'Occupé', 'BOOKED'];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Occupation des chambres</h3>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune chambre enregistrée</p>
      ) : (
        <div className="space-y-3">
          {statuses.map((status) => {
            const count = statusCounts[status] || 0;
            const percentage = rooms.length > 0 ? (count / rooms.length) * 100 : 0;

            return (
              <div key={status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn('px-2 py-0.5 rounded-md font-medium', getStatusColor(status))}>
                    {status === 'BOOKED' ? 'Réservée' : status}
                  </span>
                  <span className="text-muted-foreground">{count} chambre{count > 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', {
                      'bg-status-available': status === 'Libre',
                      'bg-status-occupied': status === 'Occupé',
                      'bg-status-booked': status === 'BOOKED',
                    })}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
