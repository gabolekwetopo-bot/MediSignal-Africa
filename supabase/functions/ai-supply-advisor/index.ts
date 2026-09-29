import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GROQ_MODEL = 'openai/gpt-oss-120b';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface RequestBody { question: string; history?: ChatMessage[]; country?: string | null; }

function normalizeGroqStream(groqBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return new ReadableStream({
    async start(controller) {
      const reader = groqBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(payload);
              const text = parsed?.choices?.[0]?.delta?.content;
              if (text) {
                const out = `event: step.delta\ndata: ${JSON.stringify({ index: 1, delta: { text, type: 'text' }, event_type: 'step.delta' })}\n\n`;
                controller.enqueue(encoder.encode(out));
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
        controller.close();
      } catch (err) { controller.error(err); }
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${req.method} not allowed.` }), {
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

    const { question, history, country } = body;
    if (typeof question !== 'string' || question.trim().length === 0 || question.length > 500) {
      return new Response(JSON.stringify({ error: 'Question must be non-empty, max 500 chars.' }), {
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

    const { data: supplyContext, error: rpcError } = await supabase.rpc('get_supply_context', {
      country_filter: country ?? null,
    });

    if (rpcError || !supplyContext) {
      return new Response(
        JSON.stringify({ error: `RPC failed: ${rpcError?.message ?? 'empty result'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const countryLabel = country ?? 'the whole African continent';

    const systemPrompt = `You are Medisignal Africa's supply chain intelligence advisor for ${countryLabel}.

You answer questions about medicine shortages, stockouts, redistribution opportunities, procurement risks, and demand anomalies using ONLY the JSON context provided below.

RULES:
- Never invent medicine names, facility names, districts, dates, or numbers. If the information is not in the context, respond: 'Insufficient Data — that information is not in the current supply snapshot.'
- Prefer specific numbers over generalities. Cite exact figures from the context.
- When listing facilities or medicines, put them in a readable bullet list.
- Keep answers under 200 words unless the user asks for a comprehensive summary.
- Do not use markdown tables. Use plain bullet lists.
- Do not restate the question. Start directly with the answer.

CONTEXT JSON:
${JSON.stringify(supplyContext)}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: question.trim() });

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Groq HTTP ${resp.status}`, details: errText.slice(0, 400) }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!resp.body) {
      return new Response(JSON.stringify({ error: 'Groq: no response body' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(normalizeGroqStream(resp.body), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-AI-Provider': 'groq',
      },
    });
  } catch (error) {
    console.error('Unhandled:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

