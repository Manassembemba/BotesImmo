import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateRoom, type Room } from '@/hooks/useRooms';
import { roomSchema, type RoomFormData } from '@/lib/validationSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useLocations } from '@/hooks/useLocations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoomBookingsHistory } from './RoomBookingsHistory'; // Import the new component

const ROOM_TYPES = [
  { value: 'SINGLE', label: 'Simple' },
  { value: 'DOUBLE', label: 'Double' },
  { value: 'SUITE', label: 'Suite' },
  { value: 'STUDIO', label: 'Studio' },
] as const;

interface EditRoomDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialActiveTab?: string; // New prop
}

export function EditRoomDialog({ room, open, onOpenChange, initialActiveTab }: EditRoomDialogProps) {
  const updateRoom = useUpdateRoom();
  const { data: locations = [] } = useLocations();
  const [activeTab, setActiveTab] = useState(initialActiveTab || 'details'); // State for active tab

  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
  });

  useEffect(() => {
    if (room) {
      form.reset({
        numero: room.numero,
        type: room.type,
        floor: room.floor,
        capacite_max: room.capacite_max,
        prix_base_nuit: room.prix_base_nuit,
        prix_base_semaine: room.prix_base_semaine,
        prix_base_mois: room.prix_base_mois,
        equipements: room.equipements || [],
        description: room.description || '',
        location_id: room.location_id || undefined,
      });
      setActiveTab(initialActiveTab || 'details'); // Reset to details or initial tab when room changes
    }
  }, [room, open, form]);

  const onSubmit = async (data: RoomFormData) => {
    if (!room) return;
    
    await updateRoom.mutateAsync({
      id: room.id,
      ...data,
    });
    onOpenChange(false);
  };
  
  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'appartement N° {room.numero}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="reservations">Réservations</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro *</FormLabel>
                        <FormControl>
                          <Input placeholder="101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Étage *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROOM_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="capacite_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacité max *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Tarification *</FormLabel>
                  <div className="grid grid-cols-3 gap-3">
                     <FormField
                      control={form.control}
                      name="prix_base_nuit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Par nuit ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="45"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prix_base_semaine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Par semaine ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="280"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prix_base_mois"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Par mois ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="1000"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Description de la chambre..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localité</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une localité" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map(location => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.nom} - {location.ville}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateRoom.isPending}>
                    {updateRoom.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="reservations">
            {room.id && <RoomBookingsHistory roomId={room.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
