const RAW_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "");

export const API_BASE = RAW_BASE.replace(/\/$/, "");

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function uploadPcap(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/captures`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  return await res.json();
}

export interface CaptureInfo {
  id: string;
  filename: string;
  size_bytes: number;
  packet_count: number;
  truncated: boolean;
  first_seen: number;
  last_seen: number;
  first_seen_str: string;
  last_seen_str: string;
  duration: number;
  protocols: Record<string, number>;
  uploaded_at: number;
  notes: string;
  tags: string[];
}

export interface UploadResponse {
  info: CaptureInfo;
  truncated: boolean;
}

export interface PacketSummary {
  index: number;
  timestamp: number;
  time_str: string;
  length: number;
  src_mac: string | null;
  dst_mac: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  src_port: number | null;
  dst_port: number | null;
  protocol: string;
  info: string;
  flags: string[];
  flow_id: string | null;
  anomaly: string | null;
  severity: string | null;
}

export interface PacketDetail {
  summary: PacketSummary;
  layers: { name: string; fields: Record<string, unknown> }[];
  hex_dump: string;
  payload_preview: string | null;
  related: { flow_id: string | null };
}

export interface FlowSummary {
  flow_id: string;
  protocol: string;
  src_ip: string;
  dst_ip: string;
  src_port: number | null;
  dst_port: number | null;
  packets: number;
  bytes: number;
  first_seen: number;
  last_seen: number;
  duration: number;
  has_anomaly: boolean;
  severity: string | null;
  first_seen_str: string;
  last_seen_str: string;
}

export interface HostSummary {
  ip: string;
  mac: string | null;
  packets_sent: number;
  packets_recv: number;
  bytes_sent: number;
  bytes_recv: number;
  peers: number;
  peer_list: string[];
  protocols: string[];
  first_seen: number;
  last_seen: number;
  first_seen_str: string;
  last_seen_str: string;
  is_private: boolean;
  role_hint: string | null;
}

export interface Alert {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  category: string;
  description: string;
  evidence: string[];
  packet_indices: number[];
  flow_ids: string[];
  hosts: string[];
  confidence: number;
}

export interface CaptureStats {
  total_bytes: number;
  avg_packet_size: number;
  packets_per_second: number;
  top_protocols: { name: string; packets: number; bytes: number }[];
  top_talkers: { ip: string; bytes: number; packets: number }[];
  top_conversations: {
    flow_id: string;
    protocol: string;
    src: string;
    dst: string;
    packets: number;
    bytes: number;
    duration: number;
    severity: string | null;
  }[];
  timeline: { t: number; packets: number; bytes: number }[];
  port_distribution: { port: number; service: string; packets: number }[];
  alert_counts: Record<string, number>;
  flow_count: number;
  host_count: number;
  private_vs_public: { private: number; public: number };
}

export const api = {
  health: () => apiFetch<{ status: string; groq_configured: boolean; model: string }>("/api/health"),
  listCaptures: () => apiFetch<{ captures: CaptureInfo[] }>("/api/captures"),
  getCapture: (id: string) => apiFetch<{ info: CaptureInfo }>(`/api/captures/${id}`),
  deleteCapture: (id: string) => apiFetch(`/api/captures/${id}`, { method: "DELETE" }),
  getStats: (id: string) =>
    apiFetch<{ info: CaptureInfo; stats: CaptureStats }>(`/api/captures/${id}/stats`),
  listPackets: (
    id: string,
    params: {
      offset?: number;
      limit?: number;
      query?: string;
      protocol?: string;
      host?: string;
      port?: number;
      severity?: string;
      flow_id?: string;
      anomaly_only?: boolean;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || v === false) return;
      qs.set(k, String(v));
    });
    return apiFetch<{
      total: number;
      offset: number;
      limit: number;
      packets: PacketSummary[];
    }>(`/api/captures/${id}/packets?${qs.toString()}`);
  },
  getPacket: (id: string, index: number) =>
    apiFetch<PacketDetail>(`/api/captures/${id}/packets/${index}`),
  listFlows: (
    id: string,
    params: {
      sort?: string;
      order?: string;
      query?: string;
      protocol?: string;
      anomaly_only?: boolean;
      limit?: number;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || v === false) return;
      qs.set(k, String(v));
    });
    return apiFetch<{ total: number; flows: FlowSummary[] }>(
      `/api/captures/${id}/flows?${qs.toString()}`
    );
  },
  getFlow: (id: string, flowId: string) =>
    apiFetch<{
      flow: FlowSummary;
      packet_indices: number[];
      stream_preview: {
        index: number;
        direction: string;
        preview: string;
        length: number;
        time: string;
      }[];
    }>(`/api/captures/${id}/flows/${encodeURIComponent(flowId)}`),
  listHosts: (id: string) => apiFetch<{ total: number; hosts: HostSummary[] }>(`/api/captures/${id}/hosts`),
  listAlerts: (id: string) => apiFetch<{ alerts: Alert[] }>(`/api/captures/${id}/alerts`),
  chat: (id: string, message: string, context?: Record<string, unknown>) =>
    apiFetch<{ reply: string; model: string; usage?: unknown }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ capture_id: id, message, context }),
    }),
  chatHistory: (id: string) =>
    apiFetch<{ history: { role: string; content: string; timestamp: number }[] }>(
      `/api/ai/chat/${id}/history`
    ),
  clearChat: (id: string) =>
    apiFetch(`/api/ai/chat/${id}/history`, { method: "DELETE" }),
  analyze: (
    id: string,
    target: "capture" | "flow" | "packet" | "host",
    target_id?: string,
    deep = false
  ) =>
    apiFetch<{ summary: string; model: string; usage?: unknown }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ capture_id: id, target, target_id, deep }),
    }),
  listBookmarks: (id: string) =>
    apiFetch<{ bookmarks: { id: string; packet_index: number; label: string; note: string; created_at: number }[] }>(
      `/api/captures/${id}/bookmarks`
    ),
  addBookmark: (id: string, packet_index: number, label = "", note = "") =>
    apiFetch<{ bookmark: { id: string; packet_index: number; label: string; note: string; created_at: number } }>(
      `/api/captures/${id}/bookmarks`,
      { method: "POST", body: JSON.stringify({ packet_index, label, note }) }
    ),
  removeBookmark: (id: string, bookmark_id: string) =>
    apiFetch(`/api/captures/${id}/bookmarks/${bookmark_id}`, { method: "DELETE" }),
  updateNotes: (id: string, text: string, tags: string[]) =>
    apiFetch(`/api/captures/${id}/notes`, {
      method: "PUT",
      body: JSON.stringify({ text, tags }),
    }),
};
