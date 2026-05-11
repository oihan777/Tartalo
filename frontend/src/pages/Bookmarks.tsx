import { useEffect, useState } from "react";
import { Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { api } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { LoadingDots } from "../components/LoadingDots";

interface BM {
  id: string;
  packet_index: number;
  label: string;
  note: string;
  created_at: number;
}

export default function Bookmarks() {
  const activeId = useStore((s) => s.activeCaptureId);
  const setSelectedPacket = useStore((s) => s.setSelectedPacket);
  const navigate = useNavigate();
  const [marks, setMarks] = useState<BM[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const r = await api.listBookmarks(activeId);
      setMarks(r.bookmarks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!activeId) return <EmptyState />;

  const remove = async (id: string) => {
    if (!activeId) return;
    await api.removeBookmark(activeId, id);
    load();
  };

  return (
    <div className="mx-auto h-full max-w-3xl space-y-4 overflow-y-auto p-6">
      <h1 className="font-display text-3xl text-parchment">Marcadores</h1>
      {loading && <LoadingDots />}
      {!loading && marks.length === 0 && (
        <div className="card p-6 text-parchment/60">
          Aún no has marcado paquetes. Selecciona un paquete y pulsa <em>Marcar</em>.
        </div>
      )}
      <div className="space-y-2">
        {marks.map((b) => (
          <div key={b.id} className="card flex items-start justify-between gap-3 p-3">
            <div>
              <div className="text-sm font-medium text-parchment">
                #{b.packet_index} · {b.label || "marcador"}
              </div>
              <div className="text-xs text-parchment/60">{b.note}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="btn"
                onClick={() => {
                  setSelectedPacket(b.packet_index);
                  navigate("/packets");
                }}
              >
                Abrir <ArrowRight size={12} />
              </button>
              <button className="btn-ghost text-ember-400" onClick={() => remove(b.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
