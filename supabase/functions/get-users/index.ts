import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Standard CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    // 1. Create a client with the user's token to check their role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header.');
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      throw new Error('Invalid user token.');
    }

    // 2. Verify the user is an admin by calling the has_role RPC
    const { data: isAdmin, error: rpcError } = await userClient.rpc('has_role', {
      _role: 'ADMIN',
      _user_id: user.id
    });

    if (rpcError) throw new Error(`RPC Error checking role: ${rpcError.message}`);
    if (!isAdmin) throw new Error('Permission denied: User is not an admin.');

    // 3. If admin, create a service role client to fetch all users and related data
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('user_id, role');
    if (rolesError) throw rolesError;

    // Fetch profiles and join with locations to get the location name
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select(`
        user_id,
        nom,
        prenom,
        username,
        location_id,
        locations ( nom )
      `);
    if (profilesError) throw profilesError;
    
    // 4. Map roles and profiles to users
    const usersWithDetails = users.map(u => {
      const userRole = roles.find(r => r.user_id === u.id);
      const userProfile = profiles.find(p => p.user_id === u.id);
      
      return {
        id: u.id,
        email: u.email,
        role: userRole ? userRole.role : 'Non assigné',
        nom: userProfile?.nom || '',
        prenom: userProfile?.prenom || '',
        username: userProfile?.username || '',
        created_at: u.created_at,
        location_id: userProfile?.location_id || null,
        location_nom: userProfile?.locations?.nom || null,
      };
    });

    return new Response(
      JSON.stringify(usersWithDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Permission denied') ? 403 : 400,
    });
  }
});
