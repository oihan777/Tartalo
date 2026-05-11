from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class PacketSummary(BaseModel):
    index: int
    timestamp: float
    time_str: str
    length: int
    src_mac: Optional[str] = None
    dst_mac: Optional[str] = None
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: str
    info: str
    flags: list[str] = Field(default_factory=list)
    flow_id: Optional[str] = None
    anomaly: Optional[str] = None
    severity: Optional[str] = None


class ProtocolLayer(BaseModel):
    name: str
    fields: dict[str, Any] = Field(default_factory=dict)
    raw_offset: Optional[int] = None
    raw_length: Optional[int] = None


class PacketDetail(BaseModel):
    summary: PacketSummary
    layers: list[ProtocolLayer]
    hex_dump: str
    payload_preview: Optional[str] = None


class FlowSummary(BaseModel):
    flow_id: str
    protocol: str
    src_ip: str
    dst_ip: str
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    packets: int
    bytes: int
    first_seen: float
    last_seen: float
    duration: float
    has_anomaly: bool = False
    severity: Optional[str] = None
    summary: Optional[str] = None


class HostSummary(BaseModel):
    ip: str
    mac: Optional[str] = None
    packets_sent: int
    packets_recv: int
    bytes_sent: int
    bytes_recv: int
    peers: int
    protocols: list[str]
    first_seen: float
    last_seen: float
    is_private: bool
    role_hint: Optional[str] = None


class Alert(BaseModel):
    id: str
    severity: str  # critical | high | medium | low | info
    title: str
    category: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    packet_indices: list[int] = Field(default_factory=list)
    flow_ids: list[str] = Field(default_factory=list)
    hosts: list[str] = Field(default_factory=list)
    confidence: float = 0.0


class CaptureInfo(BaseModel):
    id: str
    filename: str
    size_bytes: int
    packet_count: int
    truncated: bool
    first_seen: float
    last_seen: float
    duration: float
    protocols: dict[str, int]
    uploaded_at: float
    notes: str = ""
    tags: list[str] = Field(default_factory=list)


class CaptureStats(BaseModel):
    info: CaptureInfo
    total_bytes: int
    avg_packet_size: float
    packets_per_second: float
    top_protocols: list[dict[str, Any]]
    top_talkers: list[dict[str, Any]]
    top_conversations: list[dict[str, Any]]
    timeline: list[dict[str, Any]]
    port_distribution: list[dict[str, Any]]
    alert_counts: dict[str, int]
    flow_count: int
    host_count: int
    private_vs_public: dict[str, int]


class ChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str
    timestamp: Optional[float] = None
    refs: list[dict[str, Any]] = Field(default_factory=list)


class ChatRequest(BaseModel):
    capture_id: str
    message: str
    context: Optional[dict[str, Any]] = None
    deep: bool = False


class ChatResponse(BaseModel):
    reply: str
    refs: list[dict[str, Any]] = Field(default_factory=list)
    model: str
    usage: Optional[dict[str, Any]] = None


class AIAnalysisRequest(BaseModel):
    capture_id: str
    target: str  # capture | flow | packet | host
    target_id: Optional[str] = None
    deep: bool = False


class AIAnalysisResponse(BaseModel):
    summary: str
    findings: list[dict[str, Any]] = Field(default_factory=list)
    risk_level: str = "info"
    confidence: float = 0.0
    model: str
    technical_detail: Optional[str] = None


class BookmarkRequest(BaseModel):
    capture_id: str
    packet_index: int
    label: str = ""
    note: str = ""


class NoteRequest(BaseModel):
    capture_id: str
    text: str
