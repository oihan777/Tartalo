from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from ..core.store import store
from ..services.pcap_parser import (
    hex_dump,
    packet_to_layers,
    payload_preview,
    time_str,
)

router = APIRouter(prefix="/api/captures/{capture_id}/packets", tags=["packets"])


def _packet_to_summary(p, anomaly_map: dict[int, tuple[str, str]]) -> dict[str, Any]:
    anomaly = anomaly_map.get(p.index)
    return {
        "index": p.index,
        "timestamp": p.timestamp,
        "time_str": time_str(p.timestamp),
        "length": p.length,
        "src_mac": p.src_mac,
        "dst_mac": p.dst_mac,
        "src_ip": p.src_ip,
        "dst_ip": p.dst_ip,
        "src_port": p.src_port,
        "dst_port": p.dst_port,
        "protocol": p.protocol,
        "info": p.info,
        "flags": p.flags,
        "flow_id": p.flow_id,
        "anomaly": anomaly[0] if anomaly else None,
        "severity": anomaly[1] if anomaly else None,
    }


def _anomaly_map(capture) -> dict[int, tuple[str, str]]:
    m: dict[int, tuple[str, str]] = {}
    severity_rank = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    for a in capture.alerts:
        for idx in a.packet_indices:
            current = m.get(idx)
            if current is None or severity_rank.get(a.severity, 0) > severity_rank.get(current[1], 0):
                m[idx] = (a.title, a.severity)
    return m


def _packet_matches(p, query: Optional[str], protocol: Optional[str], host: Optional[str], port: Optional[int], severity: Optional[str], flow_id: Optional[str], anomaly_only: bool, anomaly_map: dict[int, tuple[str, str]]) -> bool:
    if protocol and p.protocol.lower() != protocol.lower():
        return False
    if host:
        if p.src_ip != host and p.dst_ip != host:
            return False
    if port is not None:
        if p.src_port != port and p.dst_port != port:
            return False
    if flow_id and p.flow_id != flow_id:
        return False
    if severity:
        anomaly = anomaly_map.get(p.index)
        if not anomaly or anomaly[1] != severity:
            return False
    if anomaly_only and p.index not in anomaly_map:
        return False
    if query:
        q = query.lower()
        haystack = " ".join(
            [
                p.protocol or "",
                p.info or "",
                p.src_ip or "",
                p.dst_ip or "",
                str(p.src_port or ""),
                str(p.dst_port or ""),
                p.src_mac or "",
                p.dst_mac or "",
                " ".join(p.flags),
            ]
        ).lower()
        if q not in haystack:
            return False
    return True


@router.get("")
def list_packets(
    capture_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    query: Optional[str] = None,
    protocol: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    severity: Optional[str] = None,
    flow_id: Optional[str] = None,
    anomaly_only: bool = False,
) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    amap = _anomaly_map(c)
    filtered = [p for p in c.packets if _packet_matches(p, query, protocol, host, port, severity, flow_id, anomaly_only, amap)]
    total = len(filtered)
    page = filtered[offset : offset + limit]
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "packets": [_packet_to_summary(p, amap) for p in page],
    }


@router.get("/{index}")
def get_packet(capture_id: str, index: int) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    if index < 0 or index >= len(c.packets):
        raise HTTPException(404, detail="Paquete fuera de rango.")
    p = c.packets[index]
    amap = _anomaly_map(c)
    layers = packet_to_layers(p.raw, c.linktype)
    return {
        "summary": _packet_to_summary(p, amap),
        "layers": layers,
        "hex_dump": hex_dump(p.raw),
        "payload_preview": payload_preview(p.raw),
        "related": {
            "flow_id": p.flow_id,
        },
    }
