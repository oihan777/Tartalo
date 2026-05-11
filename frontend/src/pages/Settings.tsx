import { useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api";
import { Eye } from "../components/Eye";

export default function Settings() {
  const [health, setHealth] = useState<{ status: string; groq_configured: boolean; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="mx-auto h-full max-w-3xl space-y-4 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Eye size={48} />
        <div>
          <h1 className="font-display text-3xl text-parchment">Ajustes</h1>
          <div className="text-sm text-parchment/60">Estado de la herramienta y de la integración con IA.</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-sm font-medium text-parchment">Backend</div>
        <div className="text-sm text-parchment/70">
          <div>
            Endpoint: <span className="mono text-moss-200">{API_BASE || "(mismo origen)"}</span>
          </div>
          <div>
            Estado: <span className="mono text-moss-200">{health?.status || (error ? "error" : "…")}</span>
          </div>
          {error && <div className="mt-1 text-ember-400">{error}</div>}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-sm font-medium text-parchment">IA (Groq)</div>
        <div className="text-sm text-parchment/70">
          <div>
            Configurada:{" "}
            <span className={"mono " + (health?.groq_configured ? "text-moss-200" : "text-ember-400")}>
              {health ? (health.groq_configured ? "sí" : "no") : "…"}
            </span>
          </div>
          <div>
            Modelo: <span className="mono text-moss-200">{health?.model || "—"}</span>
          </div>
          <p className="mt-2 text-xs text-parchment/50">
            La clave Groq la configura el operador del backend (variable de entorno <span className="mono">GROQ_API_KEY</span>). Tartalo usa el modelo <span className="mono">llama-3.3-70b-versatile</span> de Groq por defecto.
          </p>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-sm font-medium text-parchment">Atajos</div>
        <div className="grid grid-cols-2 gap-2 text-sm text-parchment/70">
          <div>
            <span className="kbd">⌘K</span> / <span className="kbd">Ctrl+K</span> — paleta de comandos
          </div>
          <div>
            <span className="kbd">Esc</span> — cerrar diálogos
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-sm font-medium text-parchment">Sobre Tartalo</div>
        <p className="text-sm text-parchment/70">
          Tartalo es una herramienta de análisis de red inspirada en la mitología vasca: el ojo
          gigante que todo lo ve, vigilante y profundo. Sustituye y supera la usabilidad de
          Wireshark añadiendo IA conversacional, dashboards ejecutivos, detección de anomalías
          y una experiencia de investigación clara y rápida.
        </p>
      </div>
    </div>
  );
}
