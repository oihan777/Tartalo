import { useEffect, useState } from "react";
import { ArrowRight, Filter } from "lucide-react";
import { useStore } from "../store/store";
import { api, type Alert } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";
import { SeverityBadge } from "../components/SeverityBadge";
import { useNavigate } from "react-router-dom";

export default function Alerts() {
  const activeId = useStore((s) => s.activeCaptureId);
  const setFilter = useStore((s) => s.setGlobalFilter);
  const setSelectedPacket = useStore((s) => s.setSelectedPacket);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState<string>("");

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    api
      .listAlerts(activeId)
      .then((d) => setAlerts(d.alerts))
      .finally(() => setLoading(false));
  }, [activeId]);

  if (!activeId) return <EmptyState />;

  const filtered = severity ? alerts.filter((a) => a.severity === severity) : alerts;

  return (
    <div className="mx-auto h-full max-w-5xl space-y-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-moss-200/80">Alertas</div>
          <h1 className="font-display text-3xl text-parchment">Hallazgos detectados</h1>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-moss-200" />
          {(["critical", "high", "medium", "low", "info", ""] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setSeverity(s)}
              className={
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                (severity === s
                  ? "border-moss-300/70 bg-moss-700/30 text-parchment"
                  : "border-bark-500/40 text-parchment/60")
              }
            >
              {s || "todas"}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingDots />}
      {!loading && filtered.length === 0 && (
        <div className="card p-6 text-center text-parchment/60">
          Sin alertas en esta captura para el filtro elegido.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <div className="font-display text-lg text-parchment">{a.title}</div>
                </div>
                <div className="mt-1 text-sm text-parchment/70">{a.description}</div>
                {a.evidence.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-parchment/60">
                    {a.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-parchment/60">
                  {a.hosts.map((h) => (
                    <span key={h} className="chip mono">
                      {h}
                    </span>
                  ))}
                  {a.flow_ids.length > 0 && (
                    <span className="chip">{a.flow_ids.length} flujos</span>
                  )}
                  {a.packet_indices.length > 0 && (
                    <span className="chip">{a.packet_indices.length} paquetes</span>
                  )}
                  <span className="chip">categoría: {a.category}</span>
                  <span className="chip">confianza: {(a.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {a.packet_indices.length > 0 && (
                  <button
                    className="btn"
                    onClick={() => {
                      setSelectedPacket(a.packet_indices[0]);
                      setFilter(`severity:${a.severity}`);
                      navigate("/packets");
                    }}
                  >
                    Ir a paquete <ArrowRight size={12} />
                  </button>
                )}
                {a.flow_ids[0] && (
                  <button
                    className="btn"
                    onClick={() => {
                      setFilter(`flow_id:${a.flow_ids[0]}`);
                      navigate("/packets");
                    }}
                  >
                    Ver flujo <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
