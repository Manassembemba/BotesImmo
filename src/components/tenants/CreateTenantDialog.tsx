import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTenant, useTenants, Tenant } from '@/hooks/useTenants';
import { useAuth } from '@/hooks/useAuth';
import { tenantSchema, TenantFormData } from '@/lib/validationSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, UserCheck } from 'lucide-react';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTenantCreated: (tenant: Tenant) => void;
  trigger?: React.ReactNode;
}

export function CreateTenantDialog({ open, onOpenChange, onTenantCreated, trigger }: Props) {
  const { profile } = useAuth();
  const createTenant = useCreateTenant();
  const { data: allTenants = [] } = useTenants();

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

  const watchedPhone = form.watch('telephone');
  const watchedNom = form.watch('nom');
  const watchedPrenom = form.watch('prenom');

  // Détection en direct des doublons existants
  const duplicateTenant = useMemo(() => {
    const cleanPhone = (watchedPhone || '').replace(/\s+/g, '');
    if (cleanPhone.length >= 6) {
      const found = allTenants.find(t => (t.telephone || '').replace(/\s+/g, '') === cleanPhone);
      if (found) return found;
    }
    const cleanNom = (watchedNom || '').trim().toLowerCase();
    const cleanPrenom = (watchedPrenom || '').trim().toLowerCase();
    if (cleanNom.length >= 2 && cleanPrenom.length >= 2) {
      const found = allTenants.find(
        t => t.nom.trim().toLowerCase() === cleanNom && t.prenom.trim().toLowerCase() === cleanPrenom
      );
      if (found) return found;
    }
    return null;
  }, [watchedPhone, watchedNom, watchedPrenom, allTenants]);

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
      <DialogContent className="w-[95vw] max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold">Nouveau locataire</DialogTitle>
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

            {/* Alerte si le client existe déjà */}
            {duplicateTenant && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-2 text-amber-900 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Un client similaire existe déjà dans le système !</span>
                </div>
                <div className="text-xs text-amber-800 bg-white/70 p-2 rounded-lg border border-amber-200">
                  <p className="font-bold text-sm text-foreground">
                    {duplicateTenant.prenom} {duplicateTenant.nom}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tél : {duplicateTenant.telephone || 'Non renseigné'} • {duplicateTenant.booking_count || 0} séjour(s)
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
                  onClick={() => {
                    onTenantCreated(duplicateTenant);
                    form.reset();
                    onOpenChange(false);
                  }}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Sélectionner ce profil existant (Éviter le doublon)
                </Button>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createTenant.isPending} className="w-full sm:w-auto font-bold">
                {createTenant.isPending ? 'Création...' : 'Créer le locataire'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
