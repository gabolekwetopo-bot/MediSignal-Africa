import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-3.8-flash';
const GROQ_MODEL = 'openai/gpt-oss-120b';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface RequestBody { question: string; history?: ChatMessage[]; country?: string | null; }

function buildSystemPrompt(supplyContext: unknown, countryLabel: string): string {
  return `You are Medisignal Africa's supply chain intelligence advisor for ${countryLabel}.

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
}

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

async function callGroq(apiKey: string, systemPrompt: string, history: ChatMessage[] | undefined, question: string) {
  try {
    const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: question });

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, max_tokens: 800, stream: true }),
    });
    if (!resp.ok) {
      return { ok: false as const, reason: `groq HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}` };
    }
    if (!resp.body) return { ok: false as const, reason: 'groq: no body' };
    return { ok: true as const, stream: normalizeGroqStream(resp.body) };
  } catch (err) {
    return { ok: false as const, reason: `groq threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function callGemini(apiKey: string, systemPrompt: string, inputSteps: Array<{ type: string; content: Array<{ type: string; text: string }> }>) {
  try {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ model: GEMINI_MODEL, input: inputSteps, system_instruction: systemPrompt, stream: true }),
    });
    if (!resp.ok) {
      return { ok: false as const, reason: `gemini HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}` };
    }
    if (!resp.body) return { ok: false as const, reason: 'gemini: no body' };
    return { ok: true as const, stream: resp.body };
  } catch (err) {
    return { ok: false as const, reason: `gemini threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${req.method} not allowed.` }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    let body: RequestBody;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { question, history, country } = body;

    if (typeof question !== 'string' || question.trim().length === 0 || question.length > 500) {
      return new Response(JSON.stringify({ error: 'Question must be a non-empty string, max 500 characters.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars missing.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: supplyContext, error: rpcError } = await supabase.rpc('get_supply_context', { country_filter: country ?? null });
    if (rpcError || !supplyContext) {
      return new Response(JSON.stringify({ error: `RPC failed: ${rpcError?.message ?? 'empty result'}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const countryLabel = country ?? 'the whole African continent';
    const systemPrompt = buildSystemPrompt(supplyContext, countryLabel);

    const inputSteps: Array<{ type: string; content: Array<{ type: string; text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item && typeof item.content === 'string' && (item.role === 'user' || item.role === 'assistant')) {
          inputSteps.push({ type: 'user_input', content: [{ type: 'text', text: `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}` }] });
        }
      }
    }
    inputSteps.push({ type: 'user_input', content: [{ type: 'text', text: question.trim() }] });

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const errors: string[] = [];
    let responseStream: ReadableStream<Uint8Array> | null = null;
    let source = 'none';

    if (groqKey) {
      console.log('[primary] trying Groq');
      const result = await callGroq(groqKey, systemPrompt, history, question.trim());
      if (result.ok) { responseStream = result.stream; source = 'groq'; }
      else { errors.push(result.reason); console.warn('[groq] failed:', result.reason); }
    } else { errors.push('groq: no API key'); }

    if (!responseStream && geminiKey) {
      console.log('[fallback] trying Gemini');
      const result = await callGemini(geminiKey, systemPrompt, inputSteps);
      if (result.ok) { responseStream = result.stream; source = 'gemini'; }
      else { errors.push(result.reason); console.warn('[gemini] failed:', result.reason); }
    } else if (!geminiKey) { errors.push('gemini: no API key'); }

    if (!responseStream) {
      return new Response(JSON.stringify({ error: 'All AI providers unavailable.', details: errors }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(responseStream, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-AI-Provider': source },
    });
  } catch (error) {
    console.error('Unhandled:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
