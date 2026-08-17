import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRooms } from '@/hooks/useRooms';
import { useSwitchRoom } from '@/hooks/useSwitchRoom';

export function SwitchRoomModal({
  bookingId,
  currentRoomId,
}: {
  bookingId: string;
  currentRoomId: string;
}) {
  const [newRoomId, setNewRoomId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const { data: rooms, isLoading } = useRooms();
  const switchRoom = useSwitchRoom();

  const handleSwitch = () => {
    if (!newRoomId) return;
    
    switchRoom.mutate(
      {
        bookingId,
        newRoomId,
        switchDate: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-sm font-normal px-2">Changer d'appartement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer d'appartement</DialogTitle>
          <DialogDescription>
            Sélectionnez un nouvel appartement pour cette réservation.
          </DialogDescription>
        </DialogHeader>

        <Select onValueChange={setNewRoomId} value={newRoomId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionnez un nouvel appartement" />
          </SelectTrigger>
          <SelectContent>
            {rooms
              ?.filter((r) => r.id !== currentRoomId && r.status === 'Libre')
              .map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.numero} - {room.type} ({room.prix_base_nuit} USD/nuit)
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSwitch} disabled={!newRoomId || switchRoom.isPending}>
            {switchRoom.isPending ? 'Traitement...' : 'Confirmer le changement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
