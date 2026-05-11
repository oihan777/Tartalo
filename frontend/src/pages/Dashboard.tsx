import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Cpu,
  Network,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { useStore } from "../store/store";
import { api, type Alert, type CaptureInfo, type CaptureStats } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { SeverityBadge } from "../components/SeverityBadge";
import { formatBytes, formatDuration, formatNumber } from "../lib/format";
import { useNavigate } from "react-router-dom";

const PIE_COLORS = ["#6e8451", "#b89e6f", "#d97842", "#94a978", "#8c7045", "#536638", "#c08458"];

export default function Dashboard() {
  const activeId = useStore((s) => s.activeCaptureId);
  const setSelectedFlow = useStore((s) => s.setSelectedFlow);
  const setSelectedHost = useStore((s) => s.setSelectedHost);

  const [stats, setStats] = useState<CaptureStats | null>(null);
  const [info, setInfo] = useState<CaptureInfo | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeId) {
      setStats(null);
      setInfo(null);
      setAlerts([]);
      return;
    }
    setLoading(true);
    Promise.all([api.getStats(activeId), api.listAlerts(activeId)])
      .then(([s, a]) => {
        setStats(s.stats);
        setInfo(s.info);
        setAlerts(a.alerts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeId]);

  const runAI = async () => {
    if (!activeId) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const r = await api.analyze(activeId, "capture", undefined, false);
      setAiInsight(r.summary);
    } catch (e) {
      setAiInsight(e instanceof Error ? e.message : "Error al ejecutar IA");
    } finally {
      setAiLoading(false);
    }
  };

  if (!activeId) {
    return (
      <EmptyState
        description='Sube un PCAP/PCAPNG desde la barra superior. Tartalo lo abrirá, analizará, clasificará tráfico, detectará anomalías y ofrecerá análisis IA bajo demanda.'
      />
    );
  }
  if (loading || !stats || !info) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingDots />
      </div>
    );
  }

  const totalAlerts = alerts.length;
  const alertsBySeverity = stats.alert_counts;
  const protocolPie = stats.top_protocols.slice(0, 6).map((p) => ({
    name: p.name,
    value: p.bytes,
  }));
  const timeline = stats.timeline.map((b) => ({
    t: new Date(b.t * 1000).toLocaleTimeString(),
    packets: b.packets,
    bytes: b.bytes,
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-moss-200/80">
              Captura activa
            </div>
            <h1 className="font-display text-3xl text-parchment">{info.filename}</h1>
            <div className="mt-1 text-sm text-parchment/60">
              {info.first_seen_str} → {info.last_seen_str} · {formatDuration(info.duration)} ·{" "}
              {formatNumber(info.packet_count)} paquetes
              {info.truncated && (
                <span className="ml-2 inline-flex items-center gap-1 text-ember-400">
                  <AlertTriangle size={12} /> truncada (límite de seguridad)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => navigate("/packets")}>
              Inspeccionar paquetes <ArrowRight size={14} />
            </button>
            <button className="btn-primary" onClick={runAI} disabled={aiLoading}>
              <Sparkles size={14} />
              {aiLoading ? "Analizando…" : "Análisis IA"}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <Kpi icon={<Network size={16} />} label="Paquetes" value={formatNumber(info.packet_count)} />
          <Kpi icon={<Boxes size={16} />} label="Volumen" value={formatBytes(stats.total_bytes)} />
          <Kpi icon={<Activity size={16} />} label="Pps medio" value={formatNumber(Math.round(stats.packets_per_second))} />
          <Kpi icon={<Users size={16} />} label="Hosts" value={formatNumber(stats.host_count)} />
          <Kpi icon={<Cpu size={16} />} label="Flujos" value={formatNumber(stats.flow_count)} />
          <Kpi icon={<ShieldAlert size={16} />} label="Alertas" value={formatNumber(totalAlerts)} tone={totalAlerts > 0 ? "warn" : "ok"} />
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-parchment">Tráfico en el tiempo</div>
              <div className="text-xs text-parchment/50">paquetes por segmento</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="grad-packets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a978" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#94a978" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#3f3220" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "#b89e6f", fontSize: 10 }} hide={timeline.length > 30} />
                  <YAxis tick={{ fill: "#b89e6f", fontSize: 10 }} width={36} />
                  <Tooltip
                    contentStyle={{ background: "#1d170e", border: "1px solid #5d4a2e", borderRadius: 6, color: "#efe3c8" }}
                  />
                  <Area type="monotone" dataKey="packets" stroke="#94a978" strokeWidth={2} fill="url(#grad-packets)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-2 text-sm font-medium text-parchment">Protocolos por volumen</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={protocolPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={1}
                  >
                    {protocolPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1d170e", border: "1px solid #5d4a2e", borderRadius: 6, color: "#efe3c8" }}
                    formatter={(v) => formatBytes(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {protocolPie.map((p, i) => (
                <span key={p.name} className="chip">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top talkers + ports */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-parchment">Top talkers</div>
              <button className="btn-ghost text-xs" onClick={() => navigate("/hosts")}>
                Ver hosts <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-1">
              {stats.top_talkers.slice(0, 8).map((t) => (
                <button
                  key={t.ip}
                  onClick={() => {
                    setSelectedHost(t.ip);
                    navigate("/hosts");
                  }}
                  className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-bark-700/40"
                >
                  <span className="mono w-40 truncate text-sm text-parchment">{t.ip}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bark-700/60">
                      <div
                        className="h-full bg-moss-400"
                        style={{
                          width: `${Math.min(100, (t.bytes / stats.top_talkers[0].bytes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right text-xs text-parchment/70">{formatBytes(t.bytes)}</span>
                  <span className="w-16 text-right text-xs text-parchment/50">{formatNumber(t.packets)} pkts</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-2 text-sm font-medium text-parchment">Puertos destino dominantes</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.port_distribution.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid stroke="#3f3220" strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#b89e6f", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="service"
                    tick={{ fill: "#b89e6f", fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1d170e", border: "1px solid #5d4a2e", borderRadius: 6, color: "#efe3c8" }}
                  />
                  <Bar dataKey="packets" fill="#b89e6f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top conversations */}
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-parchment">Conversaciones destacadas</div>
            <button className="btn-ghost text-xs" onClick={() => navigate("/flows")}>
              Ver todos los flujos <ArrowRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-parchment/50">
                <tr>
                  <th className="px-2 py-1 text-left">Protocolo</th>
                  <th className="px-2 py-1 text-left">Origen</th>
                  <th className="px-2 py-1 text-left">Destino</th>
                  <th className="px-2 py-1 text-right">Pkts</th>
                  <th className="px-2 py-1 text-right">Bytes</th>
                  <th className="px-2 py-1 text-right">Duración</th>
                  <th className="px-2 py-1 text-left">Severidad</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_conversations.slice(0, 10).map((c) => (
                  <tr
                    key={c.flow_id}
                    className="cursor-pointer table-row-hover"
                    onClick={() => {
                      setSelectedFlow(c.flow_id);
                      navigate("/flows");
                    }}
                  >
                    <td className="px-2 py-1.5 mono text-moss-200">{c.protocol}</td>
                    <td className="px-2 py-1.5 mono text-parchment">{c.src}</td>
                    <td className="px-2 py-1.5 mono text-parchment">{c.dst}</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(c.packets)}</td>
                    <td className="px-2 py-1.5 text-right">{formatBytes(c.bytes)}</td>
                    <td className="px-2 py-1.5 text-right">{formatDuration(c.duration)}</td>
                    <td className="px-2 py-1.5">
                      <SeverityBadge severity={c.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts + AI insight */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-parchment">Alertas recientes</div>
              <div className="flex gap-1">
                {(["critical", "high", "medium", "low", "info"] as const).map((s) => (
                  <span key={s} className={`chip severity-${s}`}>
                    {s}: {alertsBySeverity[s] ?? 0}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 6).map((a) => (
                <div key={a.id} className="card-soft p-3">
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={a.severity} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-parchment">{a.title}</div>
                      <div className="text-xs text-parchment/60">{a.description}</div>
                    </div>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        navigate("/alerts");
                      }}
                    >
                      Detalle <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-sm text-parchment/50">Sin alertas. La captura parece tranquila.</div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-parchment">
                <Sparkles size={14} className="text-moss-200" /> Insight IA
              </div>
              <button className="btn-ghost text-xs" onClick={runAI} disabled={aiLoading}>
                {aiLoading ? "Analizando…" : aiInsight ? "Regenerar" : "Generar análisis"}
              </button>
            </div>
            <div className="prose prose-invert max-w-none text-sm">
              {aiLoading && <LoadingDots />}
              {!aiLoading && aiInsight && (
                <pre className="whitespace-pre-wrap font-sans text-parchment/85">{aiInsight}</pre>
              )}
              {!aiLoading && !aiInsight && (
                <p className="text-parchment/60">
                  Pulsa <em>Generar análisis</em> para que Tartalo describa la captura, destaque hallazgos y sugiera por dónde investigar. Para preguntas específicas, abre el chat.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-parchment/50">
        <span className="text-moss-200">{icon}</span> {label}
      </div>
      <div
        className={
          "mt-1 font-display text-2xl " +
          (tone === "warn" ? "text-ember-400" : tone === "ok" ? "text-moss-200" : "text-parchment")
        }
      >
        {value}
      </div>
    </div>
  );
}
