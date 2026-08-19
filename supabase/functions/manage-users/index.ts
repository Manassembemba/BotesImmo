import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header.');

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: callingUser } } = await userClient.auth.getUser();
        if (!callingUser) throw new Error('Invalid user token.');

        const { data: isAdmin } = await userClient.rpc('has_role', {
            _role: 'ADMIN',
            _user_id: callingUser.id
        });

        if (!isAdmin) throw new Error('Permission denied.');

        const adminClient = createClient(supabaseUrl, serviceKey);
        const body = await req.json();
        const { action, payload } = body;

        console.log(`Action: ${action}`, payload);

        switch (action) {
            case 'CREATE': {
                const { email, password, role, nom, prenom, location_id, username } = payload;
                
                if (!username) {
                    throw new Error("Le nom d'utilisateur est requis.");
                }
                if (role !== 'ADMIN' && !location_id) {
                    throw new Error("Une localité est requise pour les rôles non-administrateurs.");
                }

                console.log(`Creating user: ${email} with role: ${role}`);

                // 1. Create user in Auth
                const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                });

                if (createError) {
                    console.error('Auth Create Error:', createError);
                    throw createError;
                }
                const newUserId = newUser.user.id;
                console.log(`User created in Auth: ${newUserId}.`);

                // 2. Create user profile
                console.log(`Creating profile for user ${newUserId}...`);
                const { error: profileError } = await adminClient.from('profiles').insert({
                    user_id: newUserId,
                    nom,
                    prenom,
                    username,
                    location_id: role === 'ADMIN' ? null : location_id
                });
                if (profileError) {
                    console.error('Profile Creation Error:', profileError);
                    // Attempt to clean up the created auth user
                    await adminClient.auth.admin.deleteUser(newUserId);
                    throw profileError;
                }
                
                // 3. Assign role
                console.log(`Assigning role for user ${newUserId}...`);
                const { error: roleError } = await adminClient
                    .from('user_roles')
                    .insert({ user_id: newUserId, role });

                if (roleError) {
                    console.error('Role Assign Error:', roleError);
                    // Attempt to clean up
                    await adminClient.auth.admin.deleteUser(newUserId);
                    // The profile will be cascaded
                    throw roleError;
                }

                return new Response(JSON.stringify({ success: true, user: newUser.user }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            case 'UPDATE': {
                const { userId, role, nom, prenom, location_id, username } = payload;

                if (role !== 'ADMIN' && !location_id) {
                    throw new Error("Une localité est requise pour les rôles non-administrateurs.");
                }
                
                console.log(`Updating user: ${userId}`);

                // Dynamically build the update object to avoid updating username if it's empty
                const profileUpdateData: {
                    nom: string;
                    prenom: string;
                    location_id: string | null;
                    username?: string;
                } = {
                    nom,
                    prenom,
                    location_id: role === 'ADMIN' ? null : location_id
                };

                if (username) {
                    profileUpdateData.username = username;
                }

                // 1. Update profile
                const { error: profileError } = await adminClient
                    .from('profiles')
                    .update(profileUpdateData)
                    .eq('user_id', userId);

                if (profileError) {
                    console.error('Profile Update Error:', profileError);
                    throw profileError;
                }

                // 2. Update role
                const { error: delError } = await adminClient.from('user_roles').delete().eq('user_id', userId);
                if (delError) {
                    console.error('Delete Role Error:', delError);
                    throw delError;
                }

                const { error: updateError } = await adminClient
                    .from('user_roles')
                    .insert({ user_id: userId, role });

                if (updateError) {
                    console.error('Insert Role Error:', updateError);
                    throw updateError;
                }

                console.log(`User ${userId} updated successfully.`);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            case 'DELETE': {
                const { userId } = payload;
                console.log(`Deleting user: ${userId}`);
                // Deleting the auth user should cascade to profiles and user_roles
                // if the foreign keys are set up with ON DELETE CASCADE.
                const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
                if (deleteError) {
                    console.error('Auth Delete Error:', deleteError);
                    throw deleteError;
                }

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            default:
                throw new Error(`Action non supportée: ${action}`);
        }

    } catch (error) {
        console.error('Edge Function Manage-Users Error:', error.message);
        return new Response(JSON.stringify({
            error: error.message,
            details: error.stack
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
