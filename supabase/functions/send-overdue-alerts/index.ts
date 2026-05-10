import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // NOTE: Edge functions have SUPABASE_ANON_KEY by default. 
    // We will use it just in case your SERVICE_ROLE key wasn't set right.
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // We will collect diagnostic messages to show you exactly what is happening
    const diagnostics = [];

    const { data: athletes, error } = await supabase
      .from('athletes')
      .select('*, payments(billing_month, status)');

    if (error) throw error;
    
    diagnostics.push(`Found ${athletes?.length || 0} athletes in the database.`);

    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 

    let emailsSent = 0;

    for (const athlete of athletes || []) {
      if (!athlete.email) {
        diagnostics.push(`Skipped ${athlete.name}: No email address.`);
        continue;
      }

      let overdueCount = 0;
      
      for (let i = 0; i < currentMonthIndex; i++) {
        const billingMonthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        const pay = athlete.payments?.find((p: any) => p.billing_month === billingMonthStr);
        
        if (!pay || pay.status === 'rejected') {
          overdueCount++;
        }
      }

      diagnostics.push(`Checked ${athlete.name}: Email is ${athlete.email}. Overdue months = ${overdueCount}.`);

      if (overdueCount >= 2) {
        diagnostics.push(`Attempting to send email to ${athlete.email}...`);
        
        const portalLink = `https://your-domain.com/?token=${athlete.secret_token}`; 
        
        const emailPayload = {
          from: 'Advantage Club <onboarding@resend.dev>',
          to: [athlete.email],
          // REMOVED BCC to prevent Resend Sandbox blocking!
          subject: `Action Required: ${overdueCount} Months Pending Club Fees`,
          html: `
            <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4f46e5;">Advantage Club</h2>
              <p>Hi <strong>${athlete.name}</strong>,</p>
              <p>We noticed you currently have <strong>${overdueCount} months of pending club fees</strong>.</p>
              <a href="${portalLink}">Access Private Portal</a>
            </div>
          `
        };

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        if (res.ok) {
          emailsSent++;
          diagnostics.push(`SUCCESS: Email accepted by Resend for ${athlete.name}`);
        } else {
          const resendError = await res.text();
          diagnostics.push(`FAILED: Resend rejected email for ${athlete.name}. Reason: ${resendError}`);
        }
      }
    }

    // Return the diagnostics right into your testing window!
    return new Response(JSON.stringify({ success: true, emailsSent, diagnostics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})