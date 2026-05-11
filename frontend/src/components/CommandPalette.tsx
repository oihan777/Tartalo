import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Search } from "lucide-react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  hint?: string;
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const setGlobalFilter = useStore((s) => s.setGlobalFilter);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const commands: Command[] = [
    { id: "go-dashboard", label: "Ir al Dashboard", action: () => navigate("/") },
    { id: "go-packets", label: "Ver paquetes", action: () => navigate("/packets") },
    { id: "go-flows", label: "Ver flujos", action: () => navigate("/flows") },
    { id: "go-hosts", label: "Ver hosts", action: () => navigate("/hosts") },
    { id: "go-alerts", label: "Ver alertas", action: () => navigate("/alerts") },
    { id: "go-chat", label: "Abrir Chat IA", action: () => navigate("/chat") },
    {
      id: "filter-tcp",
      label: "Filtrar por protocolo: TCP",
      action: () => {
        setGlobalFilter("protocol:TCP");
        navigate("/packets");
      },
    },
    {
      id: "filter-dns",
      label: "Filtrar por protocolo: DNS",
      action: () => {
        setGlobalFilter("protocol:DNS");
        navigate("/packets");
      },
    },
    {
      id: "filter-http",
      label: "Filtrar por protocolo: HTTP",
      action: () => {
        setGlobalFilter("protocol:HTTP");
        navigate("/packets");
      },
    },
    {
      id: "anomaly-only",
      label: "Mostrar solo paquetes con anomalía",
      action: () => {
        setGlobalFilter("anomaly:true");
        navigate("/packets");
      },
    },
  ];

  const filtered = q
    ? commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))
    : commands;

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-32 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-bark-500/60 bg-bark-900/95 shadow-organic"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-bark-600/40 px-3 py-2">
          <Search size={16} className="text-moss-200" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Comando, navegación o filtro…"
            className="w-full bg-transparent text-sm text-parchment outline-none placeholder:text-parchment/40"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                c.action();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-bark-700/40"
            >
              <span className="text-parchment">{c.label}</span>
              {c.hint && <span className="text-xs text-parchment/50">{c.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-parchment/50">
              Sin resultados
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
