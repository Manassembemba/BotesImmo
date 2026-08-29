import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateTenant, Tenant } from '@/hooks/useTenants';
import { tenantSchema, TenantFormData } from '@/lib/validationSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { UserCog, AlertTriangle } from 'lucide-react';

interface Props {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTenantDialog({ tenant, open, onOpenChange }: Props) {
  const updateTenant = useUpdateTenant();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      id_document: '',
      notes: '',
      liste_noire: false,
    },
  });

  useEffect(() => {
    if (tenant && open) {
      form.reset({
        nom: tenant.nom || '',
        prenom: tenant.prenom || '',
        email: tenant.email || '',
        telephone: tenant.telephone || '',
        id_document: tenant.id_document || '',
        notes: tenant.notes || '',
        liste_noire: !!tenant.liste_noire,
      });
    }
  }, [tenant, open, form]);

  const onSubmit = async (data: TenantFormData) => {
    if (!tenant) return;

    try {
      await updateTenant.mutateAsync({
        id: tenant.id,
        nom: data.nom,
        prenom: data.prenom,
        email: data.email || null,
        telephone: data.telephone,
        id_document: data.id_document || null,
        notes: data.notes || null,
        liste_noire: data.liste_noire,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur mise à jour locataire:", error);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <UserCog className="h-5 w-5 text-primary" />
            Modifier le locataire
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Mettez à jour les coordonnées, pièces justificatives et statut du locataire.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean" className="text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dupont" className="text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone *</FormLabel>
                    <FormControl>
                      <Input placeholder="+243 ..." className="text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="client@email.com" className="text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="id_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pièce d'identité (Passeport / CNI)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: CNI-123456 ou PASSPORT-7890" className="text-base" {...field} />
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
                  <FormLabel>Remarques / Notes internes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Préférences du client, antécédents, etc."
                      className="resize-none text-base"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="liste_noire"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 shadow-sm">
                  <div className="space-y-0.5 pr-2">
                    <FormLabel className="text-sm font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Inscrire sur la Liste Noire
                    </FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      Empêche la sélection de ce client lors de futures réservations.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateTenant.isPending}
                className="w-full sm:w-auto font-bold"
              >
                {updateTenant.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
