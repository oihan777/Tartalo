from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..core.config import settings
from ..core.store import Capture, ChatMessage, store
from ..services.analyzer import aggregate, compute_stats, role_hint
from ..services.pcap_parser import parse_packets_from_bytes, time_str

router = APIRouter(prefix="/api/captures", tags=["captures"])


def _capture_info(c: Capture) -> dict[str, Any]:
    first = c.packets[0].timestamp if c.packets else 0
    last = c.packets[-1].timestamp if c.packets else 0
    proto_counts: dict[str, int] = {}
    for p in c.packets:
        proto_counts[p.protocol] = proto_counts.get(p.protocol, 0) + 1
    return {
        "id": c.id,
        "filename": c.filename,
        "size_bytes": c.size_bytes,
        "packet_count": len(c.packets),
        "truncated": c.truncated,
        "first_seen": first,
        "last_seen": last,
        "first_seen_str": time_str(first),
        "last_seen_str": time_str(last),
        "duration": max(last - first, 0.0),
        "protocols": proto_counts,
        "uploaded_at": c.uploaded_at,
        "notes": c.notes,
        "tags": c.tags,
    }


@router.post("")
async def upload_capture(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise HTTPException(413, detail=f"Archivo demasiado grande ({size_mb:.1f} MB > {settings.max_upload_mb} MB).")
    if not data:
        raise HTTPException(400, detail="Archivo vacío.")

    try:
        packets, truncated, linktype = parse_packets_from_bytes(data, settings.max_packets_per_capture)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    if not packets:
        raise HTTPException(400, detail="No se encontraron paquetes en la captura.")

    flows, hosts, alerts = aggregate(packets)
    stats = compute_stats(packets, flows, hosts, alerts)

    capture = Capture(
        id=store.new_id(),
        filename=file.filename or "captura.pcap",
        size_bytes=len(data),
        uploaded_at=time.time(),
        packets=packets,
        flows=flows,
        hosts=hosts,
        alerts=alerts,
        stats=stats,
        linktype=linktype,
        truncated=truncated,
    )
    store.add(capture)
    return {"info": _capture_info(capture), "truncated": truncated}


@router.get("")
def list_captures() -> dict[str, Any]:
    return {"captures": [_capture_info(c) for c in store.list()]}


@router.get("/{capture_id}")
def get_capture(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    return {"info": _capture_info(c)}


@router.delete("/{capture_id}")
def delete_capture(capture_id: str) -> dict[str, Any]:
    if not store.delete(capture_id):
        raise HTTPException(404, detail="Captura no encontrada.")
    return {"ok": True}


@router.get("/{capture_id}/stats")
def capture_stats(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    return {"info": _capture_info(c), "stats": c.stats}


@router.put("/{capture_id}/notes")
def update_notes(capture_id: str, body: dict[str, Any]) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    c.notes = str(body.get("text", ""))
    c.tags = list(body.get("tags", []) or c.tags)
    return {"ok": True, "notes": c.notes, "tags": c.tags}
