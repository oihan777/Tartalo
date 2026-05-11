import clsx from "clsx";

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  const label =
    {
      critical: "crítico",
      high: "alto",
      medium: "medio",
      low: "bajo",
      info: "info",
    }[severity] || severity;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        `severity-${severity}`
      )}
    >
      {label}
    </span>
  );
}

export function ProtocolChip({ protocol }: { protocol: string }) {
  const color =
    {
      TCP: "border-clay-500/50 bg-clay-500/15 text-clay-400",
      UDP: "border-bark-300/40 bg-bark-700/40 text-bark-100",
      HTTP: "border-moss-300/50 bg-moss-700/20 text-moss-200",
      HTTPS: "border-moss-300/50 bg-moss-700/20 text-moss-200",
      TLS: "border-moss-300/50 bg-moss-700/20 text-moss-200",
      DNS: "border-amber-500/40 bg-amber-900/20 text-amber-200",
      ICMP: "border-ember-400/40 bg-ember-500/15 text-ember-400",
      ARP: "border-yellow-500/40 bg-yellow-900/20 text-yellow-200",
    }[protocol] || "border-bark-500/50 bg-bark-700/40 text-parchment/80";
  return (
    <span className={clsx("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium mono", color)}>
      {protocol}
    </span>
  );
}
