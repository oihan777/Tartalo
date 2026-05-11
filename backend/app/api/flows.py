from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from ..core.store import store
from ..services.pcap_parser import payload_preview, time_str

router = APIRouter(prefix="/api/captures/{capture_id}/flows", tags=["flows"])


def _flow_summary(f) -> dict[str, Any]:
    return {
        "flow_id": f.flow_id,
        "protocol": f.protocol,
        "src_ip": f.src_ip,
        "dst_ip": f.dst_ip,
        "src_port": f.src_port,
        "dst_port": f.dst_port,
        "packets": f.packets,
        "bytes": f.bytes,
        "first_seen": f.first_seen,
        "last_seen": f.last_seen,
        "duration": round(max(f.last_seen - f.first_seen, 0), 3),
        "has_anomaly": f.has_anomaly,
        "severity": f.severity,
        "first_seen_str": time_str(f.first_seen),
        "last_seen_str": time_str(f.last_seen),
    }


@router.get("")
def list_flows(
    capture_id: str,
    sort: str = Query("bytes", pattern="^(bytes|packets|duration|first_seen)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    query: Optional[str] = None,
    protocol: Optional[str] = None,
    anomaly_only: bool = False,
    limit: int = Query(200, ge=1, le=2000),
) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    flows = list(c.flows.values())
    if protocol:
        flows = [f for f in flows if f.protocol.lower() == protocol.lower()]
    if anomaly_only:
        flows = [f for f in flows if f.has_anomaly]
    if query:
        q = query.lower()
        flows = [
            f
            for f in flows
            if q in (f.src_ip or "").lower()
            or q in (f.dst_ip or "").lower()
            or q in (f.protocol or "").lower()
            or q in str(f.src_port or "")
            or q in str(f.dst_port or "")
        ]
    reverse = order == "desc"
    key_map = {
        "bytes": lambda f: f.bytes,
        "packets": lambda f: f.packets,
        "duration": lambda f: f.last_seen - f.first_seen,
        "first_seen": lambda f: f.first_seen,
    }
    flows.sort(key=key_map[sort], reverse=reverse)
    return {"total": len(flows), "flows": [_flow_summary(f) for f in flows[:limit]]}


@router.get("/{flow_id}")
def get_flow(capture_id: str, flow_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    f = c.flows.get(flow_id)
    if not f:
        raise HTTPException(404, detail="Flujo no encontrado.")
    # Stream reconstruction (best-effort) for TCP/UDP payloads
    payloads: list[dict[str, Any]] = []
    for idx in f.packet_indices[:200]:
        p = c.packets[idx]
        prev = payload_preview(p.raw, max_bytes=512)
        if prev:
            payloads.append(
                {
                    "index": idx,
                    "direction": "→" if p.src_ip == f.src_ip else "←",
                    "preview": prev,
                    "length": p.length,
                    "time": time_str(p.timestamp),
                }
            )
    return {
        "flow": _flow_summary(f),
        "packet_indices": f.packet_indices,
        "stream_preview": payloads[:60],
    }
