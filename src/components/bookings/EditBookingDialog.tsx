import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Booking, useUpdateBooking } from '@/hooks/useBookings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Edit, User, BedDouble, AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

const editBookingSchema = z.object({
  date_debut_prevue: z.string().min(1, 'Date d\'arrivée requise'),
  date_fin_prevue: z.string().min(1, 'Date de départ requise'),
  prix_total: z.number().min(0, 'Prix total invalide'),
  caution_encaissee: z.number().min(0, 'Caution invalide'),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Statut invalide' })
  }),
});

type EditBookingFormData = z.infer<typeof editBookingSchema>;

interface EditBookingDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBookingDialog({ booking, open, onOpenChange }: EditBookingDialogProps) {
  const updateBooking = useUpdateBooking();

  // Fonction pour formater correctement la date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        console.error('Date invalide:', dateString);
        return new Date().toISOString().split('T')[0]; // Retourner la date d'aujourd'hui si invalide
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  const form = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      date_debut_prevue: formatDate(booking.date_debut_prevue),
      date_fin_prevue: formatDate(booking.date_fin_prevue),
      prix_total: Number(booking.prix_total) || 0,
      caution_encaissee: Number(booking.caution_encaissee) || 0,
      notes: booking.notes || '',
      status: booking.status as 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    },
  });

  // Mettre à jour les valeurs par défaut quand la réservation change
  useEffect(() => {
    if (booking && open) {
      form.reset({
        date_debut_prevue: formatDate(booking.date_debut_prevue),
        date_fin_prevue: formatDate(booking.date_fin_prevue),
        prix_total: Number(booking.prix_total) || 0,
        caution_encaissee: Number(booking.caution_encaissee) || 0,
        notes: booking.notes || '',
        status: booking.status as 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
      });
    }
  }, [booking, open, form]);

  const onSubmit = async (data: EditBookingFormData) => {
    try {
      // Vérifier que les dates sont valides
      const startDate = new Date(data.date_debut_prevue);
      const endDate = new Date(data.date_fin_prevue);

      if (startDate >= endDate) {
        form.setError('date_fin_prevue', {
          message: "La date de départ doit être postérieure à la date d'arrivée"
        });
        return;
      }

      await updateBooking.mutateAsync({
        id: booking.id,
        date_debut_prevue: startDate.toISOString(),
        date_fin_prevue: endDate.toISOString(),
        prix_total: data.prix_total,
        caution_encaissee: data.caution_encaissee,
        notes: data.notes || null,
        status: data.status,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réservation:', error);
    }
  };

  if (!booking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erreur de chargement
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Aucune réservation à modifier.</p>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Modifier la réservation
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire de modification de la réservation pour {booking.tenants?.prenom} {booking.tenants?.nom}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{booking.tenants?.prenom} {booking.tenants?.nom}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            <span>Appartement {booking.rooms?.numero}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_debut_prevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d'arrivée</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_fin_prevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de départ</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prix_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix total ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caution_encaissee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caution ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">En attente</SelectItem>
                        <SelectItem value="CONFIRMED">Confirmée</SelectItem>
                        <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                        <SelectItem value="COMPLETED">Terminée</SelectItem>
                        <SelectItem value="CANCELLED">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Informations complémentaires..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateBooking.isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateBooking.isPending}
              >
                {updateBooking.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}