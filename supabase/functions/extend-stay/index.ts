import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { differenceInDays, parseISO } from "npm:date-fns";

// CORS headers for preflight and actual requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    console.log("extend-stay: Supabase client created.");

    // 1. Get original booking
    console.log("extend-stay: Fetching original booking...");
    const { data: originalBooking, error: fetchError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", p_booking_id)
      .single();

    if (fetchError) throw new Error(`Failed to fetch original booking: ${fetchError.message}`);
    if (!originalBooking) throw new Error(`Booking not found: ${p_booking_id}`);
    console.log("extend-stay: Original booking found. Price:", originalBooking.prix_total);

    // 2. Update the booking
    console.log("extend-stay: Updating booking...");
    const { data: updatedBooking, error: updateError } = await supabaseClient
      .from("bookings")
      .update({
        date_fin_prevue: p_new_date_fin_prevue,
        prix_total: p_new_prix_total,
        status: 'CONFIRMED'
      })
      .eq("id", p_booking_id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update booking: ${updateError.message}`);
    console.log("extend-stay: Booking updated successfully.");

    // 3. Calculate additional cost and create invoice if needed
    // The previous 'additionalCost' was net. Now we calculate gross, discount, and net for the extension.
    const originalEndDate = parseISO(originalBooking.date_fin_prevue);
    const newEndDate = parseISO(p_new_date_fin_prevue); // Use p_new_date_fin_prevue here

    const additionalNights = differenceInDays(newEndDate, originalEndDate);
    if (additionalNights <= 0) {
        // This case should ideally be caught by frontend validation, but as a safeguard:
        throw new Error("Additional nights must be greater than 0 for an extension invoice.");
    }

    // Fetch room details to get base price per night
    const { data: room, error: roomError } = await supabaseClient.from('rooms').select('prix_base_nuit').eq('id', updatedBooking.room_id).single();
    if (roomError) throw new Error(`Failed to fetch room details: ${roomError.message}`);
    if (!room) throw new Error("Room not found for pricing.");

    const pricePerNight = room.prix_base_nuit;

    const extensionGrossCost = additionalNights * pricePerNight;
    const extensionDiscountAmount = additionalNights * p_extension_discount_per_night;
    const extensionNetCost = extensionGrossCost - extensionDiscountAmount;

    console.log("extend-stay: Extension calculations - Gross: %s, Discount: %s, Net: %s", extensionGrossCost, extensionDiscountAmount, extensionNetCost);

    if (extensionNetCost > 0) {
      console.log("extend-stay: Extension Net Cost > 0. Proceeding to create invoice.");
      // Get tenant details for the invoice
      const { data: tenant } = await supabaseClient.from('tenants').select('*').eq('id', updatedBooking.tenant_id).single();
      if (!tenant) throw new Error("Tenant not found for invoice creation.");
      console.log("extend-stay: Found tenant for invoice.");

      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000) + 1000}`;
      const invoiceDescription = `Facture d'extension de séjour pour réservation ${originalBooking.id} du ${new Date(originalBooking.date_fin_prevue).toLocaleDateString()} au ${new Date(newEndDate).toLocaleDateString()}`;

      const newInvoice = {
        invoice_number: invoiceNumber,
        date: new Date().toISOString(),
        due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
        booking_id: updatedBooking.id,
        tenant_id: updatedBooking.tenant_id,
        status: 'ISSUED',
        items: [{
          id: crypto.randomUUID(),
          description: `Location STUDIO - ${additionalNights} nuits du ${new Date(originalBooking.date_fin_prevue).toLocaleDateString()} au ${new Date(newEndDate).toLocaleDateString()}`,
          quantity: additionalNights,
          unit_price: pricePerNight,
          total: extensionGrossCost, // Total for this line item is gross cost
        }],
        subtotal: extensionGrossCost,
        total: extensionGrossCost, // Total before discount
        discount_amount: extensionDiscountAmount,
        net_total: extensionNetCost, // Total after discount
        amount_paid: 0,
        currency: 'USD',
        notes: invoiceDescription,
        tenant_name: `${tenant.prenom} ${tenant.nom}`,
        tenant_email: tenant.email,
        tenant_phone: tenant.telephone,
        room_number: room.numero, // Using room from above
        room_type: room.type,     // Using room from above
        booking_start_date: originalBooking.date_fin_prevue,
        booking_end_date: updatedBooking.date_fin_prevue,
      };
      console.log("extend-stay: Creating invoice object:", newInvoice);

      const { error: invoiceError } = await supabaseClient.from('invoices').insert(newInvoice);
      if (invoiceError) throw new Error(`Failed to insert invoice: ${invoiceError.message}`);
      console.log("extend-stay: Invoice created successfully.");
    } else {
      console.log("extend-stay: Extension Net Cost is 0 or less. Skipping invoice creation.");
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