import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[AUTO-CHECKOUT] Starting automated checkout processing...');
    console.log('[AUTO-CHECKOUT] Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time in Africa/Lubumbashi timezone
    const { data: timeData } = await supabase.rpc('get_current_time_lubumbashi');
    const currentTime = timeData || new Date().toISOString();
    
    console.log('[AUTO-CHECKOUT] Current time (Lubumbashi):', currentTime);

    // Step 1: Process daily room transitions (check-outs automatiques à 11h)
    console.log('[AUTO-CHECKOUT] Processing daily room transitions...');
    const { data: transitionsData, error: transitionsError } = await supabase.rpc(
      'process_daily_room_transitions'
    );

    if (transitionsError) {
      console.error('[AUTO-CHECKOUT] Error processing transitions:', transitionsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: transitionsError.message,
          step: 'transitions'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTO-CHECKOUT] Transitions processed successfully');

    // Step 2: Sync room statuses
    console.log('[AUTO-CHECKOUT] Syncing room statuses...');
    const { data: syncData, error: syncError } = await supabase.rpc('sync_room_statuses');

    if (syncError) {
      console.error('[AUTO-CHECKOUT] Error syncing rooms:', syncError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: syncError.message,
          step: 'sync'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTO-CHECKOUT] Room statuses synced. Updated count:', syncData);

    // Step 3: Get statistics for the response
    const { count: pendingCheckoutsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING_CHECKOUT');

    const { count: cleaningTasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status_tache', 'TO_DO')
      .eq('type_tache', 'NETTOYAGE');

    // Step 4: Send notifications if enabled
    const { data: settingsData } = await supabase
      .from('room_sync_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_enabled')
      .eq('is_active', true)
      .single();

    const notificationsEnabled = settingsData?.setting_value?.enabled ?? true;

    if (notificationsEnabled && (syncData > 0 || transitionsData)) {
      console.log('[AUTO-CHECKOUT] Sending notifications...');
      
      // Notify via pg_notify (for real-time subscribers)
      const notificationPayload = {
        type: 'AUTO_CHECKOUT_COMPLETED',
        timestamp: currentTime,
        rooms_updated: syncData,
        transitions_processed: transitionsData,
        pending_checkouts: pendingCheckoutsCount || 0,
        cleaning_tasks: cleaningTasksCount || 0,
      };

      try {
        await supabase.rpc('send_realtime_notification', {
          channel: 'room_automation',
          payload: notificationPayload
        });
      } catch (err) {
        console.warn('[AUTO-CHECKOUT] Could not send realtime notification:', err);
      }
    }

    console.log('[AUTO-CHECKOUT] Automation completed successfully');

    // Return detailed response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automated checkout processing completed',
        data: {
          rooms_updated: syncData,
          transitions_processed: transitionsData,
          pending_checkouts: pendingCheckoutsCount || 0,
          cleaning_tasks_pending: cleaningTasksCount || 0,
          notifications_enabled: notificationsEnabled,
          processed_at: currentTime,
        },
        logs: [
          'Transitions processed successfully',
          `Room statuses synced: ${syncData} rooms updated`,
          `Pending checkouts: ${pendingCheckoutsCount || 0}`,
          `Cleaning tasks pending: ${cleaningTasksCount || 0}`,
        ]
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AUTO-CHECKOUT] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
