import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateTenant, Tenant } from '@/hooks/useTenants';
import { tenantSchema, TenantFormData } from '@/lib/validationSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface Props {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function EditTenantDialog({ tenant, open, onOpenChange, trigger }: Props) {
  const updateTenant = useUpdateTenant();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      nom: tenant.nom,
      prenom: tenant.prenom,
      email: tenant.email || '',
      telephone: tenant.telephone || '',
      id_document: tenant.id_document || '',
      notes: tenant.notes || '',
      liste_noire: tenant.liste_noire,
    },
  });

  // Update form values when tenant changes
  useEffect(() => {
    if (open) {
      form.reset({
        nom: tenant.nom,
        prenom: tenant.prenom,
        email: tenant.email || '',
        telephone: tenant.telephone || '',
        id_document: tenant.id_document || '',
        notes: tenant.notes || '',
        liste_noire: tenant.liste_noire,
      });
    }
  }, [tenant, open, form]);

  const onSubmit = async (data: TenantFormData) => {
    try {
      await updateTenant.mutateAsync({
        id: tenant.id,
        nom: data.nom,
        prenom: data.prenom,
        email: data.email || null,
        telephone: data.telephone || '',
        id_document: data.id_document || null,
        notes: data.notes || null,
        liste_noire: data.liste_noire,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Tenant update failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le locataire</DialogTitle>
          <DialogDescription>
            Mettez à jour les informations de {tenant.prenom} {tenant.nom}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="id_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pièce d'identité</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="liste_noire"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Liste noire</FormLabel>
                    <FormDescription>
                      Empêcher ce client de faire de nouvelles réservations.
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateTenant.isPending}>
                {updateTenant.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
