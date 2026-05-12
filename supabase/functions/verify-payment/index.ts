import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    console.log("1. Edge Function Triggered!");
    const { imageUrl, paymentIds, expectedAmount } = await req.json();
    console.log(`2. Payload received: Amount: €${expectedAmount}, IDs: ${paymentIds.length}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("3. Fetching and encoding image...");
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Image = encode(new Uint8Array(arrayBuffer));

    console.log("4. Calling Gemini AI...");
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Analyze this screenshot. Extract exactly two things:
              1. The total transfer amount.
              2. A "fingerprint" from the device status bar at the very top (Combine the Time and Battery percentage, e.g., "14:38-82%").
              
              Return ONLY a raw JSON object: {"amount": 30.00, "fingerprint": "14:38-82%"}. 
              If you cannot find the amount, use null. If you cannot find the status bar, use "unknown". Do not use markdown.` 
            },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    const aiResult = await aiResponse.json();
    console.log("5. Raw Gemini Response:", JSON.stringify(aiResult).substring(0, 200) + "..."); // Log the first 200 chars

    // Safely check if Gemini actually returned an answer or an error
    if (!aiResult.candidates || aiResult.candidates.length === 0) {
       throw new Error("Gemini returned an empty response. Check API Key or image quality.");
    }

    const rawText = aiResult.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    const detectedAmount = parsed.amount;
    const detectedFingerprint = parsed.fingerprint;
    console.log(`6. Extracted Data -> Amount: ${detectedAmount}, Fingerprint: ${detectedFingerprint}`);

    let status = 'verified';
    let rejectReason = null;

    if (detectedFingerprint && detectedFingerprint !== "unknown") {
      const { data: duplicate } = await supabase
        .from('payments')
        .select('id')
        .eq('transaction_ref', detectedFingerprint)
        .eq('status', 'verified')
        .maybeSingle();

      if (duplicate) {
        console.log("7. DUPLICATE FOUND!");
        status = 'rejected';
        rejectReason = "Duplicate screenshot detected";
      }
    }

    if (status !== 'rejected') {
      if (detectedAmount === null) {
        status = 'rejected';
        rejectReason = "AI could not read the amount. Please ensure the receipt is clear.";
      } else if (Math.abs(detectedAmount - expectedAmount) > 0.05) {
        status = 'rejected';
        rejectReason = `Amount mismatch. Expected €${expectedAmount.toFixed(2)}, but detected €${detectedAmount.toFixed(2)}.`;
      }
    }

    console.log(`8. Final Status: ${status}. Updating database...`);
    const { error: dbError } = await supabase
      .from('payments')
      .update({ 
        status: status, 
        amount_detected: detectedAmount, 
        reject_reason: rejectReason,
        transaction_ref: detectedFingerprint 
      })
      .in('id', paymentIds);

    if (dbError) throw dbError;

    console.log("9. Success! Database updated.");
    return new Response(JSON.stringify({ status, detectedAmount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("CRITICAL ERROR IN EDGE FUNCTION:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});