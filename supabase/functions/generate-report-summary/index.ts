import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GROQ_MODEL = 'openai/gpt-oss-120b';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: { country?: string | null } = {};
    try { body = await req.json(); } catch {}
    const country = body.country ?? null;

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ctx, error: rpcError } = await supabase.rpc('get_supply_context', {
      country_filter: country,
    });

    if (rpcError || !ctx) {
      return new Response(
        JSON.stringify({ error: `RPC failed: ${rpcError?.message ?? 'empty'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = {
      country: ctx.country,
      national_summary: ctx.national_summary,
      top_at_risk_medicines: (ctx.top_at_risk_medicines || []).slice(0, 5),
      top_at_risk_facilities: (ctx.top_at_risk_facilities || []).slice(0, 5),
      emerging_hotspots: (ctx.emerging_hotspots || []).slice(0, 3),
      redistribution_opportunities: (ctx.redistribution_opportunities || []).slice(0, 3),
      procurement_risks: ctx.procurement_risks,
    };

    const countryLabel = country ?? 'the whole African continent';

    const prompt = `You are writing a formal executive summary for a medicine supply chain situation report on ${countryLabel}. This document will be read by senior health ministry officials.

Write exactly 3 paragraphs, no headers, no bullet points, no markdown:

Paragraph 1: National situation overview. How many facilities are monitored, how many medicines are at critical or high risk, and what the overall risk posture looks like.

Paragraph 2: The most urgent concerns. Name the top 3 medicines at risk, the districts or facilities that are hotspots, and the specific stockout dates.

Paragraph 3: Recommended priority actions. Reference specific redistribution opportunities and delayed procurement orders that require immediate attention.

RULES:
- Write in third person, formal, factual tone. No first person.
- Never invent data. Use only the numbers and names in the provided context.
- Use British English spelling (organisation, prioritise, programme).
- Do not use the words "significant" or "robust".
- Keep the total under 300 words.
- Do not mention that the data is synthetic inside the summary.

CONTEXT JSON:
${JSON.stringify(trimmed)}

Generate the executive summary now.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You write formal executive summaries for government health reports.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Groq HTTP ${resp.status}`, details: errText.slice(0, 400) }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const json = await resp.json();
    const summary = json?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Groq returned empty summary', raw: JSON.stringify(json).slice(0, 400) }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ summary, generated_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

