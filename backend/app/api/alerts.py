from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.store import store

router = APIRouter(prefix="/api/captures/{capture_id}/alerts", tags=["alerts"])


def _alert_to_dict(a) -> dict[str, Any]:
    return {
        "id": a.id,
        "severity": a.severity,
        "title": a.title,
        "category": a.category,
        "description": a.description,
        "evidence": a.evidence,
        "packet_indices": a.packet_indices,
        "flow_ids": a.flow_ids,
        "hosts": a.hosts,
        "confidence": a.confidence,
    }


@router.get("")
def list_alerts(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    alerts = sorted(c.alerts, key=lambda a: severity_order.get(a.severity, 99))
    return {"alerts": [_alert_to_dict(a) for a in alerts]}
