import { Upload, FileText, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { api, type CaptureInfo, uploadPcap } from "../lib/api";
import clsx from "clsx";

export function Topbar() {
  const activeId = useStore((s) => s.activeCaptureId);
  const setActive = useStore((s) => s.setActiveCapture);
  const cache = useStore((s) => s.captureCache);
  const upsert = useStore((s) => s.upsertCapture);
  const removeFromCache = useStore((s) => s.removeCapture);

  const [captures, setCaptures] = useState<CaptureInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groqStatus, setGroqStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const data = await api.listCaptures();
      setCaptures(data.captures);
      for (const c of data.captures) upsert(c);
      if (!activeId && data.captures.length) setActive(data.captures[0].id);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refresh();
    api.health().then((h) => setGroqStatus({ configured: h.groq_configured, model: h.model })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = activeId ? cache[activeId] || captures.find((c) => c.id === activeId) : null;

  const onPick = () => fileInput.current?.click();
  const onFile = async (f: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await uploadPcap(f);
      upsert(res.info);
      setActive(res.info.id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error subiendo captura");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta captura?")) return;
    await api.deleteCapture(id);
    removeFromCache(id);
    await refresh();
  };

  return (
    <div className="flex h-14 items-center gap-3 border-b border-bark-600/40 bg-bark-900/70 px-4 backdrop-blur">
      <div className="relative">
        <button
          className="btn min-w-[280px] justify-between"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 truncate">
            <FileText size={16} className="text-moss-200" />
            {active ? (
              <>
                <span className="truncate">{active.filename}</span>
                <span className="text-xs text-parchment/50">
                  · {active.packet_count.toLocaleString()} pkts
                </span>
              </>
            ) : (
              <span className="text-parchment/60">Selecciona o sube una captura</span>
            )}
          </span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <div
            className="absolute left-0 z-50 mt-2 w-[420px] rounded-lg border border-bark-600/60 bg-bark-900/95 p-2 shadow-organic"
            onMouseLeave={() => setOpen(false)}
          >
            <div className="max-h-72 overflow-y-auto">
              {captures.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-parchment/50">
                  No hay capturas todavía. Sube un PCAP/PCAPNG para empezar.
                </div>
              )}
              {captures.map((c) => (
                <div
                  key={c.id}
                  className={clsx(
                    "group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-bark-700/40",
                    c.id === activeId && "bg-bark-700/30"
                  )}
                >
                  <button
                    onClick={() => {
                      setActive(c.id);
                      setOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <FileText size={14} className="text-moss-200" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-parchment">{c.filename}</div>
                      <div className="truncate text-xs text-parchment/50">
                        {c.packet_count.toLocaleString()} pkts ·{" "}
                        {(c.size_bytes / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => onDelete(c.id)}
                    title="Eliminar"
                  >
                    <Trash2 size={14} className="text-ember-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".pcap,.pcapng,.cap"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button className="btn-primary" onClick={onPick} disabled={uploading}>
        <Upload size={14} />
        {uploading ? "Procesando…" : "Subir captura"}
      </button>

      {error && <span className="text-xs text-ember-400">{error}</span>}

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-xs text-parchment/60">
        <Sparkles size={14} className={clsx(groqStatus?.configured ? "text-moss-200" : "text-bark-400")} />
        {groqStatus?.configured ? (
          <span>
            IA activa · <span className="mono">{groqStatus.model}</span>
          </span>
        ) : (
          <span>IA no configurada</span>
        )}
      </div>
    </div>
  );
}
