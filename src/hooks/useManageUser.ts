import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type UserCreationPayload = {
  email: string;
  password?: string;
  role: string;
  nom: string;
  prenom: string;
  username: string;
  location_id?: string | null;
};

export type UserUpdatePayload = {
  userId: string;
  role: string;
  nom: string;
  prenom: string;
  username: string;
  location_id?: string | null;
};

export function useManageUser() {
    const { session } = useAuth();
    const queryClient = useQueryClient();

    const createUser = useMutation({
        mutationFn: async (payload: UserCreationPayload) => {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'CREATE', payload },
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (error) throw new Error(data?.error || error.message);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Utilisateur créé avec succès');
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    const updateUser = useMutation({
        mutationFn: async (payload: UserUpdatePayload) => {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'UPDATE', payload },
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (error) throw new Error(data?.error || error.message);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Utilisateur mis à jour');
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    const deleteUser = useMutation({
        mutationFn: async (userId: string) => {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'DELETE', payload: { userId } },
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (error) throw new Error(data?.error || error.message);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Utilisateur supprimé');
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    return { createUser, updateUser, deleteUser };
}
