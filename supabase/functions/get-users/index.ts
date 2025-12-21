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
    console.log(`Checking role for user: ${user.id}`);
    const { data: isAdmin, error: rpcError } = await userClient.rpc('has_role', {
      _role: 'ADMIN',
      _user_id: user.id
    });

    if (rpcError) {
      console.error('RPC Error (has_role):', rpcError);
      throw new Error(`RPC Error checking role: ${rpcError.message}`);
    }

    if (!isAdmin) {
      console.warn(`User ${user.id} is not an admin.`);
      throw new Error('Permission denied: User is not an admin.');
    }

    // 3. If admin, create a service role client to fetch all users and roles
    console.log('User is admin, fetching all users...');
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) {
      console.error('Error listing users:', usersError);
      throw usersError;
    }

    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('*');
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      throw rolesError;
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('user_id, nom, prenom');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${users.length} users, ${roles.length} role assignments, and ${profiles.length} profiles.`);

    // 4. Map roles and profiles to users
    const usersWithDetails = users.map(user => {
      const userRole = roles.find(r => r.user_id === user.id);
      const userProfile = profiles.find(p => p.user_id === user.id);
      return {
        id: user.id,
        email: user.email,
        role: userRole ? userRole.role : 'Non assigné',
        nom: userProfile?.nom || '',
        prenom: userProfile?.prenom || '',
        created_at: user.created_at,
      };
    });

    return new Response(
      JSON.stringify(usersWithDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Permission denied') ? 403 : 400,
    });
  }
});
