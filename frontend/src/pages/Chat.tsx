import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "../store/store";
import { api } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { Eye } from "../components/Eye";
import clsx from "clsx";

interface Msg {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

const SUGGESTIONS = [
  "¿Qué está pasando en esta captura?",
  "¿Algún host parece sospechoso?",
  "¿Qué protocolos dominan?",
  "¿Hay indicios de C2 o exfiltración?",
  "¿Qué tráfico cifrado destaca?",
  "Resume los flujos más anómalos.",
];

export default function Chat() {
  const activeId = useStore((s) => s.activeCaptureId);
  const selectedPacket = useStore((s) => s.selectedPacket);
  const selectedFlow = useStore((s) => s.selectedFlow);
  const filter = useStore((s) => s.globalFilter);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setHistoryLoading(true);
    api
      .chatHistory(activeId)
      .then((d) =>
        setMessages(
          d.history.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
            timestamp: m.timestamp,
          }))
        )
      )
      .finally(() => setHistoryLoading(false));
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (!activeId) return <EmptyState />;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const ctx: Record<string, unknown> = {};
      if (selectedPacket != null) ctx.selected_packet = selectedPacket;
      if (selectedFlow) ctx.selected_flow = selectedFlow;
      if (filter) ctx.filter = filter;
      const r = await api.chat(activeId, trimmed, ctx);
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `**Error:** ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    await api.clearChat(activeId);
    setMessages([]);
  };

  return (
    <div className="grid h-full grid-rows-[auto,minmax(0,1fr),auto] bg-parchment">
      <div className="flex items-center justify-between border-b border-bark-600/30 bg-bark-900/70 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Eye size={28} />
          <div>
            <div className="text-sm font-medium text-parchment">Chat con Tartalo</div>
            <div className="text-xs text-parchment/60">
              Analista IA con contexto de la captura
              {selectedPacket != null && (
                <>
                  {" "}
                  · paquete <span className="mono text-moss-200">#{selectedPacket}</span>
                </>
              )}
              {selectedFlow && (
                <>
                  {" "}
                  · flujo <span className="mono text-moss-200">{selectedFlow.slice(0, 20)}…</span>
                </>
              )}
              {filter && (
                <>
                  {" "}
                  · filtro <span className="mono text-moss-200">{filter}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button className="btn-ghost text-xs" onClick={clear}>
          <Trash2 size={12} /> Limpiar
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {historyLoading && <LoadingDots />}
          {!historyLoading && messages.length === 0 && (
            <div className="card p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-parchment">
                <Sparkles size={14} className="text-moss-200" /> Pregúntale a Tartalo
              </div>
              <p className="text-sm text-parchment/70">
                Tartalo conoce la captura activa, los paquetes y flujos seleccionados, y los filtros que tienes aplicados. Puedes preguntar en lenguaje natural o usar una de las sugerencias.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="chip hover:border-moss-300/60">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={clsx("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="mt-1 shrink-0">
                  <Eye size={28} animated={false} />
                </div>
              )}
              <div
                className={clsx(
                  "max-w-[80%] rounded-xl border px-4 py-3 text-sm",
                  m.role === "user"
                    ? "border-clay-500/40 bg-clay-500/15 text-parchment"
                    : "border-bark-600/50 bg-bark-800/70 text-parchment/90 shadow-organic"
                )}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="rounded bg-bark-900/80 px-1 py-0.5 mono text-xs text-moss-200">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="my-2 overflow-x-auto rounded bg-bark-900/80 p-2 mono text-xs">
                        {children}
                      </pre>
                    ),
                    h1: ({ children }) => <h1 className="mb-1 font-display text-lg">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-1 font-display text-base">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-1 font-display text-sm uppercase tracking-wider text-moss-200">{children}</h3>,
                    ul: ({ children }) => <ul className="mb-2 list-inside list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-inside list-decimal">{children}</ol>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-parchment/60">
              <Eye size={24} />
              <span>Tartalo está observando…</span>
              <Loader2 size={14} className="animate-spin" />
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-bark-600/30 bg-bark-900/70 px-4 py-3 backdrop-blur">
        <form
          className="mx-auto flex max-w-3xl items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre la captura, un paquete, flujo, host…"
            className="input"
          />
          <button className="btn-primary" disabled={sending || !input.trim()}>
            <Send size={14} /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
