import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles } from 'lucide-react';
import { useCountry } from '../context/CountryContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isWaiting?: boolean;
  isError?: boolean;
}

const SUGGESTIONS = [
  'Which medicines are most at risk in the next 14 days?',
  'Which facilities may experience stockouts this month?',
  'Where is there potential surplus?',
  'Which delayed orders are most concerning?',
  'Summarize the national medicine supply situation.',
  'Which districts are emerging hotspots?',
];

export function AISupplyAdvisorPage() {
  const { country } = useCountry();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(question: string) {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: question };
    const assistantId = `a-${Date.now()}`;
    const placeholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      isWaiting: true,
    };

    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInputValue('');
    setIsStreaming(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-supply-advisor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history, country }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        const errMsg = err.error || `HTTP ${resp.status}`;
        const details = Array.isArray(err.details) ? ` (${err.details.join(' | ')})` : '';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isWaiting: false, isStreaming: false, isError: true, content: `${errMsg}${details}` }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              if (currentEvent === 'step.delta' && parsed.delta?.text) {
                if (firstChunk) {
                  firstChunk = false;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, isWaiting: false } : m))
                  );
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + parsed.delta.text } : m
                  )
                );
              } else if (currentEvent === 'error') {
                const msg = parsed.error?.message || 'AI service error';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, isWaiting: false, isStreaming: false, isError: true, content: msg }
                      : m
                  )
                );
                setIsStreaming(false);
                return;
              }
            } catch {}
          } else if (line === '') {
            currentEvent = '';
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, isWaiting: false } : m))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, isWaiting: false, isStreaming: false, isError: true, content: msg }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSend() {
    const q = inputValue.trim();
    if (!q || isStreaming) return;
    sendMessage(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-500" />
            AI Supply Advisor
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {country ? `Context: ${country}` : 'Context: All Africa'} · Grounded in live demonstration data
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-300"
          >
            New Chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-100 text-cyan-600 mb-4">
              <Sparkles size={22} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Ask about medicine shortages, redistribution, or procurement risks across Africa.
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Answers are generated from the live supply snapshot. No hallucinated data.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInputValue(s)}
                  className="text-left text-sm bg-white border border-slate-200 rounded-lg px-4 py-2.5 hover:border-cyan-400 hover:bg-cyan-50/40 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.role === 'user' ? (
              <div className="bg-blue-600 text-white rounded-2xl px-4 py-2 max-w-[80%] text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%]">
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <Sparkles size={11} className="text-cyan-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600">
                    Medisignal AI
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-5 py-4 text-sm border ${
                    m.isError
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  {m.isWaiting ? (
                    <div>
                      <div className="text-[11px] italic text-slate-400 mb-2">
                        Medisignal AI is analyzing the supply snapshot...
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  ) : m.isError ? (
                    <div>{m.content}</div>
                  ) : (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children }) => <code className="bg-slate-100 px-1 py-0.5 rounded text-[12px] font-mono">{children}</code>,
                          h1: ({ children }) => <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                      {m.isStreaming && <span className="inline-block w-1.5 h-4 bg-cyan-500 ml-0.5 animate-pulse align-text-bottom" />}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about shortages, redistribution, procurement risks..."
            className="flex-1 resize-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-lg p-2.5 transition"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="max-w-3xl mx-auto text-[10px] text-slate-400 mt-1 text-right">
          {inputValue.length}/500
        </div>
      </div>
    </div>
  );
}
