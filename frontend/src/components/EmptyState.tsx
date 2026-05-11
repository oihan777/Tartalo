import { Eye } from "./Eye";

export function EmptyState({
  title = "Tartalo aún no ve nada",
  description = "Sube una captura PCAP o PCAPNG para empezar el análisis.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="opacity-80">
        <Eye size={96} />
      </div>
      <div className="font-display text-3xl text-parchment">{title}</div>
      <div className="max-w-md text-sm text-parchment/60">{description}</div>
      {action}
    </div>
  );
}
