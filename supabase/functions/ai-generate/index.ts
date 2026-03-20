// Supabase Edge Function: AI Generation Proxy
// Keeps the Replicate API key server-side. Clients authenticate via Supabase JWT.
//
// Deploy: supabase functions deploy ai-generate --no-verify-jwt
// Set secret: supabase secrets set REPLICATE_API_KEY=r8_...
//
// The function:
// 1. Verifies the user's Supabase JWT
// 2. Checks their subscription tier and generation limits
// 3. Forwards the request to Replicate
// 4. Returns the prediction result

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TIER_LIMITS: Record<string, { maxGenerations: number; maxDuration: number }> = {
  free: { maxGenerations: 3, maxDuration: 15 },
  pro: { maxGenerations: 50, maxDuration: 120 },
  studio: { maxGenerations: 999999, maxDuration: 300 },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.slice(7);

    // Verify user with Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile + limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, ai_generations_used, ai_generations_reset_at')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check monthly reset
    const resetAt = new Date(profile.ai_generations_reset_at);
    let generationsUsed = profile.ai_generations_used;
    if (new Date() > resetAt) {
      generationsUsed = 0;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      nextMonth.setHours(0, 0, 0, 0);
      await supabase
        .from('profiles')
        .update({ ai_generations_used: 0, ai_generations_reset_at: nextMonth.toISOString() })
        .eq('id', user.id);
    }

    const limits = TIER_LIMITS[profile.subscription_tier] || TIER_LIMITS.free;

    if (generationsUsed >= limits.maxGenerations) {
      return new Response(JSON.stringify({ error: 'Monthly generation limit reached. Upgrade your plan.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { version, input } = body;

    if (!version || !input) {
      return new Response(JSON.stringify({ error: 'Missing version or input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce duration limit
    if (input.duration && input.duration > limits.maxDuration) {
      input.duration = limits.maxDuration;
    }

    // Forward to Replicate
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'respond-async',
      },
      body: JSON.stringify({ version, input }),
    });

    const prediction = await replicateRes.json();

    if (!replicateRes.ok) {
      return new Response(JSON.stringify({ error: prediction.detail || 'Replicate API error' }), {
        status: replicateRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment generation count
    await supabase
      .from('profiles')
      .update({ ai_generations_used: generationsUsed + 1 })
      .eq('id', user.id);

    // Log generation
    await supabase.from('ai_generations').insert({
      user_id: user.id,
      prompt: input.prompt || input.description || '',
      model: version.includes('stable-audio') ? 'stableAudio25' : 'musicgen',
      duration: input.duration || 15,
      status: 'pending',
    });

    return new Response(JSON.stringify(prediction), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
