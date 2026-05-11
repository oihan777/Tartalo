import { useEffect, useState } from "react";
import { Sparkles, Search, Globe2, LockKeyhole } from "lucide-react";
import { useStore } from "../store/store";
import { api, type HostSummary } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { formatBytes, formatNumber } from "../lib/format";
import clsx from "clsx";

export default function Hosts() {
  const activeId = useStore((s) => s.activeCaptureId);
  const selected = useStore((s) => s.selectedHost);
  const setSelected = useStore((s) => s.setSelectedHost);
  const [hosts, setHosts] = useState<HostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    api
      .listHosts(activeId)
      .then((d) => setHosts(d.hosts))
      .finally(() => setLoading(false));
  }, [activeId]);

  if (!activeId) return <EmptyState />;

  const filtered = q ? hosts.filter((h) => h.ip.includes(q) || (h.mac || "").includes(q)) : hosts;
  const selectedHost = hosts.find((h) => h.ip === selected) || null;

  const runAI = async () => {
    if (!activeId || !selectedHost) return;
    setAiLoading(true);
    try {
      const r = await api.analyze(activeId, "host", selectedHost.ip, false);
      setAiSummary(r.summary);
    } catch (e) {
      setAiSummary(e instanceof Error ? e.message : "Error");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[1fr,1fr]">
      <div className="flex h-full flex-col overflow-hidden border-r border-bark-600/30">
        <div className="flex items-center gap-2 border-b border-bark-600/30 px-4 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-bark-500/40 bg-bark-900/70 px-3">
            <Search size={14} className="text-moss-200" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por IP o MAC…"
              className="flex-1 bg-transparent py-2 text-sm text-parchment outline-none placeholder:text-parchment/40"
            />
          </div>
          <div className="text-xs text-parchment/60">{filtered.length} hosts</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-bark-900/95 text-[10px] uppercase tracking-wider text-parchment/50 backdrop-blur">
              <tr>
                <th className="px-2 py-2 text-left">IP</th>
                <th className="px-2 py-2 text-left">MAC</th>
                <th className="px-2 py-2 text-right">↑ Bytes</th>
                <th className="px-2 py-2 text-right">↓ Bytes</th>
                <th className="px-2 py-2 text-right">Peers</th>
                <th className="px-2 py-2 text-left">Protocolos</th>
                <th className="px-2 py-2 text-left">Rol</th>
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
              {!loading &&
                filtered.map((h) => (
                  <tr
                    key={h.ip}
                    onClick={() => setSelected(h.ip)}
                    className={clsx(
                      "cursor-pointer border-b border-bark-700/30 table-row-hover",
                      selected === h.ip && "bg-moss-700/20"
                    )}
                  >
                    <td className="px-2 py-1.5 mono">
                      <span className="inline-flex items-center gap-1">
                        {h.is_private ? (
                          <LockKeyhole size={10} className="text-moss-200" />
                        ) : (
                          <Globe2 size={10} className="text-clay-400" />
                        )}
                        {h.ip}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 mono text-parchment/60">{h.mac || "—"}</td>
                    <td className="px-2 py-1.5 text-right">{formatBytes(h.bytes_sent)}</td>
                    <td className="px-2 py-1.5 text-right">{formatBytes(h.bytes_recv)}</td>
                    <td className="px-2 py-1.5 text-right">{h.peers}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {h.protocols.slice(0, 4).map((p) => (
                          <span key={p} className="chip">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-parchment/70">{h.role_hint || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-y-auto">
        {!selectedHost && (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-parchment/50">
            Selecciona un host para ver su perfil y peers.
          </div>
        )}
        {selectedHost && (
          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-parchment/50">Host</div>
                <div className="font-display text-2xl text-parchment mono">
                  {selectedHost.ip}
                </div>
                <div className="text-xs text-parchment/60">
                  MAC: <span className="mono">{selectedHost.mac || "—"}</span> ·{" "}
                  {selectedHost.is_private ? "privado" : "público"} ·{" "}
                  rol estimado: {selectedHost.role_hint || "—"}
                </div>
              </div>
              <button className="btn-primary" onClick={runAI} disabled={aiLoading}>
                <Sparkles size={12} /> {aiLoading ? "Analizando…" : "Análisis IA"}
              </button>
            </div>

            {aiSummary && (
              <div className="card p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-moss-200">
                  <Sparkles size={12} /> Comportamiento del host
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-parchment/85">{aiSummary}</pre>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Enviado" value={`${formatBytes(selectedHost.bytes_sent)} · ${formatNumber(selectedHost.packets_sent)} pkts`} />
              <Stat label="Recibido" value={`${formatBytes(selectedHost.bytes_recv)} · ${formatNumber(selectedHost.packets_recv)} pkts`} />
              <Stat label="Peers" value={String(selectedHost.peers)} />
              <Stat label="Protocolos" value={selectedHost.protocols.join(", ") || "—"} />
              <Stat label="Primer visto" value={selectedHost.first_seen_str} />
              <Stat label="Último visto" value={selectedHost.last_seen_str} />
            </div>

            <div className="card p-3">
              <div className="mb-2 text-xs uppercase tracking-wider text-parchment/50">Peers</div>
              <div className="flex flex-wrap gap-1">
                {selectedHost.peer_list.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelected(p)}
                    className="chip mono hover:border-moss-300/60"
                  >
                    {p}
                  </button>
                ))}
                {selectedHost.peer_list.length === 0 && (
                  <div className="text-xs text-parchment/50">Sin peers registrados.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft p-2">
      <div className="text-[10px] uppercase tracking-wider text-parchment/50">{label}</div>
      <div className="mt-0.5 text-sm text-parchment">{value}</div>
    </div>
  );
}
