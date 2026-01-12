import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useLocations';
import { type Location as LocationType } from '@/hooks/useLocations';

const locationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(100, "Le nom ne doit pas dépasser 100 caractères"),
  adresse_ligne1: z.string().min(1, "L'adresse est requise").max(200, "L'adresse est trop longue"),
  adresse_ligne2: z.string().max(200, "Le complément d'adresse est trop long").optional().or(z.literal('')),
  ville: z.string().min(1, "La ville est requise").max(100, "Le nom de la ville est trop long"),
  province: z.string().max(100, "Le nom de la province est trop long").optional().or(z.literal('')),
  pays: z.string().min(1, "Le pays est requis").max(100, "Le nom du pays est trop long"),
  code_postal: z.string().max(20, "Le code postal est trop long").optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(500, "La description est trop longue").optional().or(z.literal('')),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationManagementProps {
  onLocationSelected?: (locationId: string) => void;
}

export function LocationManagement({ onLocationSelected }: LocationManagementProps) {
  const { data: locations = [], isLoading } = useLocations();
  const createLocationMutation = useCreateLocation();
  const updateLocationMutation = useUpdateLocation();
  const deleteLocationMutation = useDeleteLocation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationType | null>(null);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      nom: '',
      adresse_ligne1: '',
      adresse_ligne2: '',
      ville: '',
      province: '',
      pays: 'RDC', // Valeur par défaut
      code_postal: '',
      latitude: undefined,
      longitude: undefined,
      description: '',
    },
  });

  const onSubmit = async (data: LocationFormData) => {
    if (editingLocation) {
      await updateLocationMutation.mutateAsync({ 
        id: editingLocation.id, 
        ...data 
      });
    } else {
      const locationData = {
        nom: data.nom,
        adresse_ligne1: data.adresse_ligne1,
        adresse_ligne2: data.adresse_ligne2,
        ville: data.ville,
        province: data.province,
        pays: data.pays,
        code_postal: data.code_postal,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description
      };
      await createLocationMutation.mutateAsync(locationData as Omit<LocationType, 'id' | 'created_at' | 'updated_at'>);
    }

    setIsDialogOpen(false);
    setEditingLocation(null);
    form.reset();
  };

  const handleEdit = (location: LocationType) => {
    setEditingLocation(location);
    form.reset({
      nom: location.nom,
      adresse_ligne1: location.adresse_ligne1,
      adresse_ligne2: location.adresse_ligne2 || '',
      ville: location.ville,
      province: location.province || '',
      pays: location.pays,
      code_postal: location.code_postal || '',
      latitude: location.latitude,
      longitude: location.longitude,
      description: location.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette localité ?")) {
      deleteLocationMutation.mutateAsync(id);
    }
  };

  const handleAddNew = () => {
    setEditingLocation(null);
    form.reset({
      nom: '',
      adresse_ligne1: '',
      adresse_ligne2: '',
      ville: '',
      province: '',
      pays: 'RDC', // Valeur par défaut
      code_postal: '',
      latitude: undefined,
      longitude: undefined,
      description: '',
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Gestion des Localités
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez et gérez les différents sites de votre entreprise
          </p>
        </div>
        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une localité
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p>Chargement des localités...</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-foreground">Nom</TableHead>
                <TableHead className="font-semibold text-foreground">Adresse</TableHead>
                <TableHead className="font-semibold text-foreground">Ville</TableHead>
                <TableHead className="font-semibold text-foreground">Pays</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length > 0 ? (
                locations.map(location => (
                  <TableRow key={location.id} className="hover:bg-accent/50 transition-colors">
                    <TableCell className="font-medium">{location.nom}</TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <p className="truncate max-w-xs">{location.adresse_ligne1}</p>
                        {location.adresse_ligne2 && (
                          <p className="truncate max-w-xs text-muted-foreground">{location.adresse_ligne2}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{location.ville}</TableCell>
                    <TableCell>{location.pays}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(location)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDelete(location.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucune localité enregistrée. Commencez par en ajouter une.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {locations.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Aucune localité enregistrée</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Commencez par ajouter votre première localité pour gérer vos différentes propriétés.
          </p>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une localité
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Modifier la localité' : 'Ajouter une localité'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Complexe Oasis, Résidence ABC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="adresse_ligne1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse * (Ligne 1)</FormLabel>
                    <FormControl>
                      <Input placeholder="Numéro de rue, Avenue, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="adresse_ligne2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complément d'adresse</FormLabel>
                    <FormControl>
                      <Input placeholder="Appartement, bâtiment, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville *</FormLabel>
                      <FormControl>
                        <Input placeholder="Kinshasa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province/État</FormLabel>
                      <FormControl>
                        <Input placeholder="Kinshasa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pays *</FormLabel>
                      <FormControl>
                        <Input placeholder="RDC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="code_postal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          min={-90} 
                          max={90} 
                          placeholder="-4.4419" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any" 
                          min={-180} 
                          max={180} 
                          placeholder="15.2663" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informations complémentaires sur la localité..." 
                        rows={3} 
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
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingLocation(null);
                  }}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                >
                  {(createLocationMutation.isPending || updateLocationMutation.isPending) 
                    ? 'Enregistrement...' 
                    : editingLocation 
                      ? 'Mettre à jour' 
                      : 'Créer'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}