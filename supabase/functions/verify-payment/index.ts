import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageUrl, paymentId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    const supabase = createClient(supabaseUrl!, supabaseKey!)

    // Fetch and safely convert image to base64
    const imageResponse = await fetch(imageUrl)
    const arrayBuffer = await imageResponse.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);

    // Call Gemini AI
    const geminiPayload = {
      contents: [{
        parts: [
          { text: "Analyze this payment receipt screenshot. Extract 3 things: 1. The total amount paid (number only). 2. The phone's system time from the top status bar (e.g., '12:21'). 3. The battery percentage from the top status bar (number only, e.g., '52'). Return ONLY a raw JSON object with no markdown formatting: {\"amount\": 30.00, \"time\": \"12:21\", \"battery\": \"52\"}. If time or battery are cropped/missing, use \"UNKNOWN\"." },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } }
        ]
      }]
    }

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    })

    const aiData = await aiResponse.json()
    if (!aiData.candidates || !aiData.candidates[0]) {
      throw new Error("Google Gemini API rejected the request.");
    }

    // Parse AI Response
    const aiText = aiData.candidates[0].content.parts[0].text
    const cleanedText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanedText);
    
    const detectedAmount = extractedData.amount
    
    let fingerprint = "UNKNOWN";
    if (extractedData.time !== "UNKNOWN" && extractedData.battery !== "UNKNOWN") {
      fingerprint = `${extractedData.time}-${extractedData.battery}`;
    }

    // 1. Anti-Fraud Duplicate Check
    if (fingerprint !== "UNKNOWN") {
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('id')
        .eq('transaction_ref', fingerprint)
        .neq('id', paymentId);

      if (existingPayments && existingPayments.length > 0) {
        await supabase.from('payments').update({ 
          status: 'rejected',
          amount_detected: detectedAmount,
          transaction_ref: fingerprint,
          reject_reason: 'Duplicate receipt detected. This transaction has already been submitted.'
        }).eq('id', paymentId);

        return new Response(JSON.stringify({ success: true, status: 'rejected - duplicate' }), { headers: corsHeaders });
      }
    }

    // 2. Amount Check against Athlete's Required Fee
    const { data: paymentRecord } = await supabase.from('payments').select('athlete_id').eq('id', paymentId).single()
    const { data: athlete } = await supabase.from('athletes').select('monthly_fee').eq('id', paymentRecord.athlete_id).single()

    let finalStatus = 'rejected'
    let reason = 'The uploaded receipt does not match your required monthly fee.'

    if (detectedAmount >= athlete.monthly_fee) {
      finalStatus = 'verified'
      reason = null
    }

    // Final Database Update
    await supabase.from('payments').update({ 
      status: finalStatus, 
      amount_detected: detectedAmount,
      transaction_ref: fingerprint,
      reject_reason: reason
    }).eq('id', paymentId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err) {
    // Keep minimum error tracking for major server crashes
    console.error("[FATAL ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})