import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.12.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Always log the start
  console.log("--- HANDSHAKE: Function Triggered ---")

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, paymentId } = await req.json()
    console.log(`Targeting Payment: ${paymentId}`)
    console.log(`Targeting Image: ${imageUrl}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing!")

    // Initialize AI
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-lite"});

    // Step A: Fetch the image
    console.log("Step A: Fetching image...")
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`Image fetch failed: ${res.statusText}`)
    
    const arrayBuffer = await res.arrayBuffer()
    
    // SAFE BASE64 CONVERSION for 2026 (No more spread operator crashes)
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    const len = uint8Array.byteLength
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i])
    }
    const base64 = btoa(binary)

    // Step B: Gemini Process
    console.log("Step B: Sending to Gemini...")
    const prompt = "How much is the total amount in this receipt? Return only the number."
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: base64, mimeType: "image/jpeg" } }
        ]
      }]
    })
    
    const response = await result.response;
    const amountText = response.text().trim();

    // This regex is smarter: it finds the first number with decimals
    const match = amountText.match(/\d+(\.\d+)?/);
    const amount = match ? parseFloat(match[0]) : 0;
    console.log(`Step C: AI detected: ${amount}`)

    // Step D: Update DB
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        amount_detected: amount,
        status: amount > 0 ? 'verified' : 'rejected' 
      })
      .eq('id', paymentId)

    if (updateError) throw updateError
    console.log("--- SUCCESS: Database Updated ---")

    return new Response(JSON.stringify({ success: true, amount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error("!!! CRITICAL FUNCTION ERROR:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})