import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { differenceInCalendarDays, parseISO } from "npm:date-fns";

// CORS headers for preflight and actual requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR');
};

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("extend-stay: Function invoked.");
    const { p_booking_id, p_new_date_fin_prevue, p_new_prix_total, p_extension_discount_per_night } = await req.json();
    console.log("extend-stay: Received params:", { p_booking_id, p_new_date_fin_prevue, p_new_prix_total, p_extension_discount_per_night });

    // Create a Supabase client with the user's authorization
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Get original booking
    const { data: originalBooking, error: fetchError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", p_booking_id)
      .single();

    if (fetchError) throw new Error(`Failed to fetch original booking: ${fetchError.message}`);
    if (!originalBooking) throw new Error(`Booking not found: ${p_booking_id}`);

    // Forcer l'heure de fin à 11:00 AM pour la nouvelle date
    const newEndDateObj = parseISO(p_new_date_fin_prevue);
    const forcedNewEndDate = new Date(newEndDateObj.getFullYear(), newEndDateObj.getMonth(), newEndDateObj.getDate(), 11, 0, 0);
    const forcedNewEndDateISO = forcedNewEndDate.toISOString();
    const originalEndDate = parseISO(originalBooking.date_fin_prevue);

    // 2. Calculate additional nights using calendar days to match frontend
    const additionalNights = differenceInCalendarDays(forcedNewEndDate, originalEndDate);
    if (additionalNights <= 0) {
      throw new Error(`Additional nights must be greater than 0 for an extension. (Calculated: ${additionalNights} nights between ${originalBooking.date_fin_prevue} and ${forcedNewEndDateISO})`);
    }

    // 3. Update the booking (Once, with correct values)
    console.log("extend-stay: Updating booking with forced 11:00 AM end date...");
    const { data: updatedBooking, error: updateError } = await supabaseClient
      .from("bookings")
      .update({
        date_fin_prevue: forcedNewEndDateISO,
        prix_total: p_new_prix_total,
        status: 'CONFIRMED'
      })
      .eq("id", p_booking_id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update booking: ${updateError.message}`);

    // 4. Calculate extension costs
    const { data: room, error: roomError } = await supabaseClient.from('rooms').select('*').eq('id', updatedBooking.room_id).single();
    if (roomError) throw new Error(`Failed to fetch room details: ${roomError.message}`);

    const pricePerNight = room.prix_base_nuit;
    const extensionGrossCost = additionalNights * pricePerNight;
    const extensionDiscountAmount = additionalNights * (p_extension_discount_per_night || 0);
    const extensionNetCost = extensionGrossCost - extensionDiscountAmount;

    if (extensionNetCost > 0) {
      console.log("extend-stay: Extension Net Cost > 0. Creating extension invoice.");
      const { data: tenant } = await supabaseClient.from('tenants').select('*').eq('id', updatedBooking.tenant_id).single();
      if (!tenant) throw new Error("Tenant not found for invoice creation.");

      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000) + 1000}`;
      const stayDescription = `Extension ${room.type} n°${room.numero} - ${additionalNights} nuits du ${formatDate(originalBooking.date_fin_prevue)} au ${formatDate(forcedNewEndDateISO)}`;

      const newInvoice = {
        invoice_number: invoiceNumber,
        date: new Date().toISOString(),
        due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
        booking_id: updatedBooking.id,
        tenant_id: updatedBooking.tenant_id,
        status: 'ISSUED',
        items: [{
          id: crypto.randomUUID(),
          description: stayDescription,
          quantity: additionalNights,
          unit_price: pricePerNight,
          total: extensionGrossCost,
        }],
        subtotal: extensionGrossCost,
        total: extensionGrossCost,
        discount_amount: extensionDiscountAmount,
        net_total: extensionNetCost,
        amount_paid: 0,
        currency: 'USD',
        notes: `Facture d'extension de séjour. (Taux: ${p_extension_discount_per_night || 0}$ de remise/nuit)`,
        tenant_name: `${tenant.prenom} ${tenant.nom}`,
        tenant_email: tenant.email,
        tenant_phone: tenant.telephone,
        room_number: room.numero,
        room_type: room.type,
        booking_start_date: originalBooking.date_fin_prevue,
        booking_end_date: forcedNewEndDateISO,
      };

      const { error: invoiceError } = await supabaseClient.from('invoices').insert(newInvoice);
      if (invoiceError) throw new Error(`Failed to insert invoice: ${invoiceError.message}`);
    } else {
      console.log("extend-stay: Extension cost is 0 or less. Creating no invoice.");
    }

    console.log("extend-stay: Function finished successfully.");
    return new Response(JSON.stringify(updatedBooking), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("extend-stay: An error occurred:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});