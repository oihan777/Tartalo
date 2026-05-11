export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "0s";
  if (sec < 60) return `${sec.toFixed(2)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", "");
}

export function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}
