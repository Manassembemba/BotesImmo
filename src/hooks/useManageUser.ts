import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useManageUser() {
    const { session } = useAuth();
    const queryClient = useQueryClient();

    const createUser = useMutation({
        mutationFn: async (payload: any) => {
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

    const updateRole = useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'UPDATE_ROLE', payload: { userId, role } },
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (error) throw new Error(data?.error || error.message);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Rôle mis à jour');
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

    return { createUser, updateRole, deleteUser };
}
