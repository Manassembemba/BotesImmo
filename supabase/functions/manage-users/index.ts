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

        const { data: { user } } = await userClient.auth.getUser();
        if (!user) throw new Error('Invalid user token.');

        const { data: isAdmin } = await userClient.rpc('has_role', {
            _role: 'ADMIN',
            _user_id: user.id
        });

        if (!isAdmin) throw new Error('Permission denied.');

        const adminClient = createClient(supabaseUrl, serviceKey);
        const body = await req.json();
        const { action, payload } = body;

        console.log(`Action: ${action}`, payload);

        switch (action) {
            case 'CREATE': {
                const { email, password, role, nom, prenom } = payload;
                console.log(`Creating user: ${email} with role: ${role}`);

                const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { nom, prenom }
                });

                if (createError) {
                    console.error('Auth Create Error:', createError);
                    throw createError;
                }

                console.log(`User created in Auth: ${newUser.user.id}. Assigning role...`);
                await adminClient.from('user_roles').delete().eq('user_id', newUser.user.id);
                const { error: roleError } = await adminClient
                    .from('user_roles')
                    .insert({ user_id: newUser.user.id, role });

                if (roleError) {
                    console.error('Role Assign Error:', roleError);
                    throw roleError;
                }

                return new Response(JSON.stringify({ success: true, user: newUser.user }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            case 'UPDATE_ROLE': {
                const { userId, role } = payload;
                console.log(`Updating role for user: ${userId} to: ${role}`);

                // Use a transaction-like approach by deleting then inserting
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

                console.log(`Role updated successfully for ${userId}`);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            case 'DELETE': {
                const { userId } = payload;
                console.log(`Deleting user: ${userId}`);
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
