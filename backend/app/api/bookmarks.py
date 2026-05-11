from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.store import Bookmark, store

router = APIRouter(prefix="/api/captures/{capture_id}/bookmarks", tags=["bookmarks"])


@router.get("")
def list_bookmarks(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    return {"bookmarks": [b.__dict__ for b in c.bookmarks]}


@router.post("")
def add_bookmark(capture_id: str, body: dict[str, Any]) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    idx = int(body.get("packet_index", -1))
    if idx < 0 or idx >= len(c.packets):
        raise HTTPException(400, detail="packet_index inválido.")
    b = Bookmark(
        id=uuid.uuid4().hex[:8],
        packet_index=idx,
        label=str(body.get("label", "")),
        note=str(body.get("note", "")),
    )
    c.bookmarks.append(b)
    return {"bookmark": b.__dict__}


@router.delete("/{bookmark_id}")
def delete_bookmark(capture_id: str, bookmark_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    before = len(c.bookmarks)
    c.bookmarks = [b for b in c.bookmarks if b.id != bookmark_id]
    return {"ok": len(c.bookmarks) < before}
