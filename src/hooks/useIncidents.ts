import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface Incident {
  id: string;
  room_id: string;
  reported_by: string | null;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  photos: string[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  rooms?: {
    numero: string;
  };
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          rooms (numero)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Incident[];
    },
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (incident: Omit<Incident, 'id' | 'created_at' | 'updated_at' | 'reported_by' | 'rooms'>) => {
      const { data, error } = await supabase
        .from('incidents')
        .insert({ ...incident, reported_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast({ title: 'Incident signalé', description: 'L\'incident a été enregistré avec succès' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, resolved_at }: { id: string; status: Incident['status']; resolved_at?: string | null }) => {
      const { data, error } = await supabase
        .from('incidents')
        .update({ status, resolved_at })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast({ title: 'Incident mis à jour' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });
}
