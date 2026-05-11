import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Copy,
  Filter,
  Sparkles,
  X,
} from "lucide-react";
import { useStore } from "../store/store";
import {
  api,
  type PacketDetail,
  type PacketSummary,
} from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { ProtocolChip, SeverityBadge } from "../components/SeverityBadge";
import { formatBytes } from "../lib/format";
import clsx from "clsx";

const PAGE = 200;

function parseFilter(filter: string) {
  const parts = filter.trim().split(/\s+/).filter(Boolean);
  const out: Record<string, string> = {};
  const free: string[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z_]+):(.+)$/);
    if (m) out[m[1].toLowerCase()] = m[2];
    else free.push(p);
  }
  if (free.length) out["query"] = free.join(" ");
  return out;
}

export default function Packets() {
  const activeId = useStore((s) => s.activeCaptureId);
  const selected = useStore((s) => s.selectedPacket);
  const setSelected = useStore((s) => s.setSelectedPacket);
  const filter = useStore((s) => s.globalFilter);
  const setFilter = useStore((s) => s.setGlobalFilter);

  const [packets, setPackets] = useState<PacketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PacketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [explain, setExplain] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const parsed = useMemo(() => parseFilter(filter), [filter]);

  const fetchList = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        offset,
        limit: PAGE,
        query: parsed.query || "",
      };
      if (parsed.protocol) params.protocol = parsed.protocol;
      if (parsed.host) params.host = parsed.host;
      if (parsed.port) params.port = Number(parsed.port);
      if (parsed.severity) params.severity = parsed.severity;
      if (parsed.flow_id) params.flow_id = parsed.flow_id;
      if (parsed.anomaly === "true") params.anomaly_only = true;
      const data = await api.listPackets(activeId, params as never);
      setPackets(data.packets);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [activeId, offset, parsed]);

  useEffect(() => {
    setOffset(0);
  }, [filter, activeId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!activeId || selected == null) {
      setDetail(null);
      setExplain(null);
      return;
    }
    setDetailLoading(true);
    setExplain(null);
    api
      .getPacket(activeId, selected)
      .then((d) => setDetail(d))
      .finally(() => setDetailLoading(false));
  }, [activeId, selected]);

  if (!activeId) return <EmptyState />;

  const explainPacket = async () => {
    if (!activeId || selected == null) return;
    setExplainLoading(true);
    setExplain(null);
    try {
      const r = await api.analyze(activeId, "packet", String(selected), false);
      setExplain(r.summary);
    } catch (e) {
      setExplain(e instanceof Error ? e.message : "Error");
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="grid h-full grid-rows-[auto,minmax(0,1fr)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-bark-600/30 px-4 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-bark-500/40 bg-bark-900/70 px-3">
          <Filter size={14} className="text-moss-200" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtro · ej: protocol:TCP host:10.0.0.5 port:443 severity:high anomaly:true GET"
            className="flex-1 bg-transparent py-2 text-sm text-parchment outline-none placeholder:text-parchment/40"
          />
          {filter && (
            <button onClick={() => setFilter("")} className="text-parchment/60">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs text-parchment/60">
          {total.toLocaleString()} paquetes · página {offset / PAGE + 1} /{" "}
          {Math.max(1, Math.ceil(total / PAGE))}
        </div>
        <button
          className="btn"
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
          disabled={offset === 0}
        >
          Anterior
        </button>
        <button
          className="btn"
          onClick={() => setOffset(offset + PAGE)}
          disabled={offset + PAGE >= total}
        >
          Siguiente
        </button>
      </div>

      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[1.4fr,1fr]">
        <div className="overflow-y-auto border-r border-bark-600/30">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-bark-900/95 text-[10px] uppercase tracking-wider text-parchment/50 backdrop-blur">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Tiempo</th>
                <th className="px-2 py-2 text-left">Proto</th>
                <th className="px-2 py-2 text-left">Origen</th>
                <th className="px-2 py-2 text-left">Destino</th>
                <th className="px-2 py-2 text-right">Len</th>
                <th className="px-2 py-2 text-left">Info</th>
                <th className="px-2 py-2 text-left">Sev</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6">
                    <LoadingDots />
                  </td>
                </tr>
              )}
              {!loading && packets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-parchment/50">
                    No hay paquetes que cumplan el filtro.
                  </td>
                </tr>
              )}
              {!loading &&
                packets.map((p) => (
                  <tr
                    key={p.index}
                    onClick={() => setSelected(p.index)}
                    className={clsx(
                      "cursor-pointer border-b border-bark-700/30 table-row-hover",
                      selected === p.index && "bg-moss-700/20"
                    )}
                  >
                    <td className="px-2 py-1.5 mono text-parchment/70">{p.index}</td>
                    <td className="px-2 py-1.5 mono text-parchment/70">
                      {p.time_str.split("T")[1]?.split("+")[0] || p.time_str}
                    </td>
                    <td className="px-2 py-1.5">
                      <ProtocolChip protocol={p.protocol} />
                    </td>
                    <td className="px-2 py-1.5 mono text-parchment">
                      {p.src_ip}
                      {p.src_port ? `:${p.src_port}` : ""}
                    </td>
                    <td className="px-2 py-1.5 mono text-parchment">
                      {p.dst_ip}
                      {p.dst_port ? `:${p.dst_port}` : ""}
                    </td>
                    <td className="px-2 py-1.5 text-right text-parchment/70">{p.length}</td>
                    <td className="px-2 py-1.5 text-parchment/80">
                      <span className="line-clamp-1">{p.info}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <SeverityBadge severity={p.severity} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-y-auto">
          {selected == null && (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-parchment/50">
              Selecciona un paquete para ver su árbol de protocolos, hexdump y análisis IA.
            </div>
          )}
          {selected != null && detailLoading && (
            <div className="p-6">
              <LoadingDots />
            </div>
          )}
          {selected != null && detail && (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-parchment/50">
                    Paquete #{detail.summary.index}
                  </div>
                  <div className="font-display text-xl text-parchment">{detail.summary.info}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-parchment/60">
                    <ProtocolChip protocol={detail.summary.protocol} />
                    <span className="mono">{detail.summary.time_str}</span>
                    <span>· {detail.summary.length} bytes</span>
                    {detail.summary.severity && (
                      <SeverityBadge severity={detail.summary.severity} />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    className="btn-primary"
                    onClick={explainPacket}
                    disabled={explainLoading}
                  >
                    <Sparkles size={12} />
                    {explainLoading ? "Pensando…" : "Explicar"}
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={async () => {
                      if (!activeId) return;
                      await api.addBookmark(activeId, detail.summary.index, detail.summary.protocol, detail.summary.info);
                    }}
                  >
                    <Bookmark size={12} /> Marcar
                  </button>
                </div>
              </div>

              {explain && (
                <div className="card p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-moss-200">
                    <Sparkles size={12} /> Análisis IA del paquete
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-parchment/85">{explain}</pre>
                </div>
              )}

              <div className="card p-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-parchment/50">
                  Árbol de protocolos
                </div>
                <div className="space-y-1">
                  {detail.layers.map((l, i) => (
                    <LayerNode key={i} layer={l} defaultOpen={i < 3} />
                  ))}
                </div>
              </div>

              {detail.payload_preview && (
                <div className="card p-3">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-parchment/50">
                    <span>Payload (texto)</span>
                    <button
                      className="btn-ghost text-[10px]"
                      onClick={() => navigator.clipboard.writeText(detail.payload_preview || "")}
                    >
                      <Copy size={10} /> Copiar
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-all rounded bg-bark-900/80 p-2 mono text-xs text-parchment/85">
                    {detail.payload_preview}
                  </pre>
                </div>
              )}

              <div className="card p-3">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-parchment/50">
                  <span>Hexdump</span>
                  <span className="text-[10px]">{formatBytes(detail.summary.length)}</span>
                </div>
                <pre className="overflow-x-auto rounded bg-bark-900/80 p-2 mono text-[11px] text-parchment/85">
                  {detail.hex_dump}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerNode({
  layer,
  defaultOpen = false,
}: {
  layer: { name: string; fields: Record<string, unknown> };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(layer.fields);
  return (
    <div className="rounded border border-bark-600/30 bg-bark-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown size={12} className="text-moss-200" />
        ) : (
          <ChevronRight size={12} className="text-moss-200" />
        )}
        <span className="font-display text-base text-parchment">{layer.name}</span>
        <span className="text-[10px] text-parchment/50">{entries.length} campos</span>
      </button>
      {open && (
        <div className="border-t border-bark-700/40 px-3 py-2 text-xs">
          <table className="w-full">
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-40 py-0.5 align-top layer-key mono">{k}</td>
                  <td className="py-0.5 layer-val mono">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td className="text-parchment/50">Sin campos extraídos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
