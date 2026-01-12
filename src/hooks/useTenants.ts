import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocationFilter } from '@/context/LocationFilterContext';

export interface Tenant {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  id_document: string | null;
  notes: string | null;
  liste_noire: boolean;
  location_id?: string;
  created_at: string;
  updated_at: string;
  booking_count?: number; // From RPC
}

export function useTenants() {
  const { selectedLocationId, userLocationId } = useLocationFilter();

  return useQuery({
    queryKey: ['tenants', selectedLocationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenants_with_stats', {
        p_location_id: selectedLocationId || null
      });

      if (error) {
        console.error("Error fetching tenants with stats:", error);
        throw error;
      };
      return data as Tenant[];
    },
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert(tenant)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Locataire créé', description: 'Le locataire a été ajouté avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...tenant }: Partial<Tenant> & { id: string }) => {
      const { data, error } = await supabase
        .from('tenants')
        .update(tenant)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Locataire mis à jour', description: 'Les modifications ont été enregistrées' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}
