import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GROQ_MODEL = 'openai/gpt-oss-120b';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  question: string;
  conversation?: ChatMessage[];
  country?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: RequestBody;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question, conversation, country } = body;

    if (typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Question is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: supplyContext } = await supabase.rpc('get_supply_context', {
      country_filter: country ?? null,
    });

    const countryLabel = country ?? 'the whole African continent';

    const trimmedContext = supplyContext ? {
      country: supplyContext.country,
      national_summary: supplyContext.national_summary,
      top_at_risk_medicines: (supplyContext.top_at_risk_medicines || []).slice(0, 8),
      top_at_risk_facilities: (supplyContext.top_at_risk_facilities || []).slice(0, 8),
      emerging_hotspots: (supplyContext.emerging_hotspots || []).slice(0, 5),
      redistribution_opportunities: (supplyContext.redistribution_opportunities || []).slice(0, 5),
      procurement_risks: supplyContext.procurement_risks,
    } : null;

    const conversationText = Array.isArray(conversation) && conversation.length > 0
      ? conversation.map(c => `${c.role === 'assistant' ? 'Advisor' : 'User'}: ${c.content}`).join('\n\n')
      : `User: ${question}`;

    const systemPrompt = `You are writing a formal briefing document for a medicine supply chain situation report on ${countryLabel}. This document will be read by senior health ministry officials.

Context: A user asked Medisignal's AI Supply Advisor the following question, and received an answer. Your task is to expand that exchange into a structured briefing.

The BRIEFING will contain:
- An executive summary (2 short paragraphs)
- Detailed findings (bullet points citing specific numbers, facilities, medicines, dates)
- Recommended priority actions (3-5 specific bullet points)

RULES:
- Never invent data. Use only numbers, facility names, medicine names, and dates from the provided context and conversation.
- Write in third person, formal tone.
- Use British English spelling.
- Do not use markdown headers or tables in your output. Use plain paragraphs for the summary, and dash-prefixed bullet points for the findings and actions.
- Keep the total under 400 words.

USER QUESTION:
${question}

CONVERSATION TRANSCRIPT:
${conversationText}

LIVE SUPPLY CONTEXT:
${JSON.stringify(trimmedContext)}

Write the briefing now. Start directly with the executive summary paragraph (no heading). After two paragraphs, add a line with just "FINDINGS:" then bullet points. Then a line with just "ACTIONS:" then bullet points.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You write formal briefing documents for government health ministries.' },
          { role: 'user', content: systemPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2500,
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
    const narrative = json?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!narrative) {
      return new Response(
        JSON.stringify({ error: 'Groq returned empty briefing' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ narrative, generated_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
