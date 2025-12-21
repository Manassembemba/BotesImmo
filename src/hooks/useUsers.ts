import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth'; // To get the auth token

export interface User {
  id: string;
  email: string | undefined;
  role: string;
  nom: string;
  prenom: string;
  created_at: string;
}

export function useUsers() {
  const { session } = useAuth(); // Get the current session to extract the JWT

  return useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: async () => {
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Invoke the edge function with the user's JWT
      const { data, error } = await supabase.functions.invoke('get-users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('Error invoking get-users function:', error);
        const errorMessage = data?.error || error.message || 'Failed to fetch users';
        throw new Error(errorMessage);
      }

      return data as User[];
    },
    enabled: !!session, // Only run the query if a session exists
  });
}
