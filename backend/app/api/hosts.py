from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..core.store import store
from ..services.analyzer import role_hint
from ..services.pcap_parser import _is_private_ip, time_str

router = APIRouter(prefix="/api/captures/{capture_id}/hosts", tags=["hosts"])


def _host_summary(h) -> dict[str, Any]:
    return {
        "ip": h.ip,
        "mac": h.mac,
        "packets_sent": h.packets_sent,
        "packets_recv": h.packets_recv,
        "bytes_sent": h.bytes_sent,
        "bytes_recv": h.bytes_recv,
        "peers": len(h.peers),
        "peer_list": sorted(list(h.peers))[:30],
        "protocols": sorted(list(h.protocols)),
        "first_seen": h.first_seen,
        "last_seen": h.last_seen,
        "first_seen_str": time_str(h.first_seen),
        "last_seen_str": time_str(h.last_seen),
        "is_private": _is_private_ip(h.ip),
        "role_hint": role_hint(h),
    }


@router.get("")
def list_hosts(
    capture_id: str,
    sort: str = Query("bytes", pattern="^(bytes|packets|peers)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(200, ge=1, le=2000),
) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    hosts = list(c.hosts.values())
    key_map = {
        "bytes": lambda h: h.bytes_sent + h.bytes_recv,
        "packets": lambda h: h.packets_sent + h.packets_recv,
        "peers": lambda h: len(h.peers),
    }
    hosts.sort(key=key_map[sort], reverse=(order == "desc"))
    return {"total": len(hosts), "hosts": [_host_summary(h) for h in hosts[:limit]]}


@router.get("/{ip}")
def get_host(capture_id: str, ip: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    h = c.hosts.get(ip)
    if not h:
        raise HTTPException(404, detail="Host no encontrado.")
    related_flows = [fid for fid, f in c.flows.items() if f.src_ip == ip or f.dst_ip == ip][:50]
    return {"host": _host_summary(h), "flows": related_flows}
