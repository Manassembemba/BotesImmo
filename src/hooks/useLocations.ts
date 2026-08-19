import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Define the Location interface matching the database table
export interface Location {
  id: string;
  created_at: string;
  updated_at: string;
  nom: string;
  adresse_ligne1: string;
  adresse_ligne2?: string | null;
  ville: string;
  province?: string | null;
  pays: string;
  code_postal?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
}

/**
 * Fetches all locations from the database.
 */
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('nom', { ascending: true });
      
      if (error) throw error;
      return data as Location[];
    },
  });
}

/**
 * Creates a new location.
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (location: Omit<Location, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('locations')
        .insert(location)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: 'Localité créée', description: 'La nouvelle localité a été ajoutée.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

/**
 * Updates an existing location.
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...location }: Partial<Location> & { id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update(location)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: 'Localité mise à jour', description: 'Les modifications ont été enregistrées.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

/**
 * Deletes a location.
 */
export function useDeleteLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: 'Localité supprimée', description: 'La localité a été supprimée.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

/**
 * Gets a single location by ID.
 */
export function useLocation(id: string) {
  return useQuery({
    queryKey: ['location', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Location;
    },
    enabled: !!id,
  });
}
