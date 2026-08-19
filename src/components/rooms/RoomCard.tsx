import { BedDouble, Users, Wifi, Tv, Wind, Coffee, Eye, MoreVertical } from 'lucide-react';
import { Room } from '@/hooks/useRooms';
import { getStatusLabel, getStatusColor, getRoomTypeLabel } from '@/lib/roomUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RoomCardProps {
  room: Room;
  onClick?: () => void;
}

const equipmentIcons: Record<string, typeof Wifi> = {
  'WiFi': Wifi,
  'TV': Tv,
  'Climatisation': Wind,
  'Mini-bar': Coffee,
};

export function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <div 
      className="group rounded-xl border bg-card p-4 shadow-soft transition-all hover:shadow-medium hover:border-primary/20 cursor-pointer animate-fade-in"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
            {room.numero}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Chambre {room.numero}</h3>
            <p className="text-sm text-muted-foreground">{getRoomTypeLabel(room.type)} • Étage {room.floor}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Modifier</DropdownMenuItem>
            <DropdownMenuItem>Voir les détails</DropdownMenuItem>
            <DropdownMenuItem>Créer une réservation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', getStatusColor(room.status))}>
          {getStatusLabel(room.status)}
        </span>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{room.capacite_max}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {(room.equipements || []).slice(0, 4).map((eq) => {
          const Icon = equipmentIcons[eq] || BedDouble;
          return (
            <div key={eq} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground" title={eq}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          );
        })}
        {(room.equipements || []).length > 4 && (
          <span className="text-xs text-muted-foreground">+{room.equipements.length - 4}</span>
        )}
      </div>

      <div className="flex items-end justify-between pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Prix / nuit</p>
          <CurrencyDisplay amountUSD={Number(room.prix_base_nuit)} className="text-lg font-semibold text-foreground" />
        </div>
        <Button variant="secondary" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          <Eye className="h-4 w-4" />
          Détails
        </Button>
      </div>
    </div>
  );
}
