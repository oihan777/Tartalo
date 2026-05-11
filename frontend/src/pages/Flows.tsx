import { useEffect, useState } from "react";
import { ArrowRight, Filter, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { api, type FlowSummary } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { ProtocolChip, SeverityBadge } from "../components/SeverityBadge";
import { formatBytes, formatDuration, formatNumber } from "../lib/format";
import clsx from "clsx";

export default function Flows() {
  const activeId = useStore((s) => s.activeCaptureId);
  const selected = useStore((s) => s.selectedFlow);
  const setSelected = useStore((s) => s.setSelectedFlow);
  const setSelectedPacket = useStore((s) => s.setSelectedPacket);
  const setFilter = useStore((s) => s.setGlobalFilter);
  const navigate = useNavigate();

  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [streamData, setStreamData] = useState<{
    flow: FlowSummary;
    packet_indices: number[];
    stream_preview: {
      index: number;
      direction: string;
      preview: string;
      length: number;
      time: string;
    }[];
  } | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    api
      .listFlows(activeId, { query, anomaly_only: anomalyOnly, limit: 500 })
      .then((d) => setFlows(d.flows))
      .finally(() => setLoading(false));
  }, [activeId, query, anomalyOnly]);

  useEffect(() => {
    if (!activeId || !selected) {
      setStreamData(null);
      setAiSummary(null);
      return;
    }
    setStreamLoading(true);
    setAiSummary(null);
    api
      .getFlow(activeId, selected)
      .then(setStreamData)
      .finally(() => setStreamLoading(false));
  }, [activeId, selected]);

  if (!activeId) return <EmptyState />;

  const runAI = async () => {
    if (!activeId || !selected) return;
    setAiLoading(true);
    try {
      const r = await api.analyze(activeId, "flow", selected, false);
      setAiSummary(r.summary);
    } catch (e) {
      setAiSummary(e instanceof Error ? e.message : "Error");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[1.2fr,1fr]">
      <div className="flex h-full flex-col overflow-hidden border-r border-bark-600/30">
        <div className="flex items-center gap-2 border-b border-bark-600/30 px-4 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-bark-500/40 bg-bark-900/70 px-3">
            <Filter size={14} className="text-moss-200" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por IP, puerto, protocolo…"
              className="flex-1 bg-transparent py-2 text-sm text-parchment outline-none placeholder:text-parchment/40"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-parchment/60">
                <X size={14} />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-parchment/70">
            <input type="checkbox" checked={anomalyOnly} onChange={(e) => setAnomalyOnly(e.target.checked)} />
            Solo anómalos
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-bark-900/95 text-[10px] uppercase tracking-wider text-parchment/50 backdrop-blur">
              <tr>
                <th className="px-2 py-2 text-left">Proto</th>
                <th className="px-2 py-2 text-left">Origen</th>
                <th className="px-2 py-2 text-left">Destino</th>
                <th className="px-2 py-2 text-right">Pkts</th>
                <th className="px-2 py-2 text-right">Bytes</th>
                <th className="px-2 py-2 text-right">Dur.</th>
                <th className="px-2 py-2 text-left">Sev</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6">
                    <LoadingDots />
                  </td>
                </tr>
              )}
              {!loading && flows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-parchment/50">
                    Sin flujos.
                  </td>
                </tr>
              )}
              {!loading &&
                flows.map((f) => (
                  <tr
                    key={f.flow_id}
                    onClick={() => setSelected(f.flow_id)}
                    className={clsx(
                      "cursor-pointer border-b border-bark-700/30 table-row-hover",
                      selected === f.flow_id && "bg-moss-700/20"
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <ProtocolChip protocol={f.protocol} />
                    </td>
                    <td className="px-2 py-1.5 mono">
                      {f.src_ip}
                      {f.src_port ? `:${f.src_port}` : ""}
                    </td>
                    <td className="px-2 py-1.5 mono">
                      {f.dst_ip}
                      {f.dst_port ? `:${f.dst_port}` : ""}
                    </td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(f.packets)}</td>
                    <td className="px-2 py-1.5 text-right">{formatBytes(f.bytes)}</td>
                    <td className="px-2 py-1.5 text-right">{formatDuration(f.duration)}</td>
                    <td className="px-2 py-1.5">
                      <SeverityBadge severity={f.severity} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-y-auto">
        {!selected && (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-parchment/50">
            Selecciona un flujo para reconstruir el stream y analizar.
          </div>
        )}
        {selected && streamLoading && (
          <div className="p-6">
            <LoadingDots />
          </div>
        )}
        {selected && streamData && (
          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-parchment/50">Flujo</div>
                <div className="font-display text-xl text-parchment">
                  {streamData.flow.src_ip}:{streamData.flow.src_port} ↔ {streamData.flow.dst_ip}:
                  {streamData.flow.dst_port}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-parchment/60">
                  <ProtocolChip protocol={streamData.flow.protocol} />
                  <span>{formatNumber(streamData.flow.packets)} paquetes</span>
                  <span>· {formatBytes(streamData.flow.bytes)}</span>
                  <span>· {formatDuration(streamData.flow.duration)}</span>
                  <SeverityBadge severity={streamData.flow.severity} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setFilter(`flow_id:${streamData.flow.flow_id}`);
                    navigate("/packets");
                  }}
                >
                  Ver paquetes <ArrowRight size={12} />
                </button>
                <button className="btn-primary" onClick={runAI} disabled={aiLoading}>
                  <Sparkles size={12} />
                  {aiLoading ? "Analizando…" : "IA"}
                </button>
              </div>
            </div>

            {aiSummary && (
              <div className="card p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-moss-200">
                  <Sparkles size={12} /> Análisis IA del flujo
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-parchment/85">{aiSummary}</pre>
              </div>
            )}

            <div className="card p-3">
              <div className="mb-2 text-xs uppercase tracking-wider text-parchment/50">
                Reconstrucción de stream
              </div>
              {streamData.stream_preview.length === 0 ? (
                <div className="text-sm text-parchment/50">
                  Sin payload textual reconstituible (probablemente cifrado o binario).
                </div>
              ) : (
                <div className="space-y-2">
                  {streamData.stream_preview.map((s) => (
                    <div
                      key={s.index}
                      onClick={() => {
                        setSelectedPacket(s.index);
                        navigate("/packets");
                      }}
                      className={clsx(
                        "cursor-pointer rounded border p-2 text-xs",
                        s.direction === "→"
                          ? "border-moss-300/30 bg-moss-700/10"
                          : "border-clay-500/30 bg-clay-500/10"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px] text-parchment/50">
                        <span>
                          {s.direction} pkt #{s.index} · {s.time}
                        </span>
                        <span>{s.length} bytes</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all mono text-[11px] text-parchment/85">
                        {s.preview.slice(0, 800)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
