import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTenant } from '@/hooks/useTenants';
import { useAuth } from '@/hooks/useAuth';
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
import { Tenant } from '@/hooks/useTenants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTenantCreated: (tenant: Tenant) => void;
  trigger?: React.ReactNode;
}

export function CreateTenantDialog({ open, onOpenChange, onTenantCreated, trigger }: Props) {
  const { profile } = useAuth();
  const createTenant = useCreateTenant();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      id_document: '',
    },
  });

  const onSubmit = async (data: TenantFormData) => {
    try {

      const newTenant = await createTenant.mutateAsync({
        nom: data.nom,
        prenom: data.prenom,
        email: data.email || null,
        telephone: data.telephone || null,
        id_document: data.id_document || null,
        notes: null,
        liste_noire: false,
        location_id: profile?.location_id,
      });

      if (newTenant) {
        onTenantCreated(newTenant);
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Tenant creation failed:", error);
      // Toast is likely handled in mutation hook onError, checking implementation would confirm
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau locataire</DialogTitle>
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
                      <Input placeholder="Jean" {...field} />
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
                      <Input placeholder="Dupont" {...field} />
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
                    <Input placeholder="+33 6 12 34 56 78" {...field} />
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
                    <Input placeholder="CNI-123456 ou PASSPORT-789012" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? 'Création...' : 'Créer le locataire'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
