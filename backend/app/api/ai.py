from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.store import ChatMessage, store
from ..services.analyzer import role_hint
from ..services.groq_client import (
    GroqUnavailable,
    build_capture_context,
    chat_complete,
)
from ..services.pcap_parser import _is_private_ip, hex_dump, packet_to_layers, time_str

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _alert_dict_list(c) -> list[dict[str, Any]]:
    return [
        {
            "id": a.id,
            "severity": a.severity,
            "title": a.title,
            "category": a.category,
            "description": a.description,
            "hosts": a.hosts,
            "confidence": a.confidence,
        }
        for a in c.alerts
    ]


def _capture_brief(c) -> dict[str, Any]:
    return {
        "id": c.id,
        "filename": c.filename,
        "packets": len(c.packets),
        "flows": len(c.flows),
        "hosts": len(c.hosts),
        "alerts": len(c.alerts),
        "first": time_str(c.packets[0].timestamp) if c.packets else None,
        "last": time_str(c.packets[-1].timestamp) if c.packets else None,
        "truncated": c.truncated,
    }


@router.post("/analyze")
def analyze(body: dict[str, Any]) -> dict[str, Any]:
    capture_id = body.get("capture_id")
    target = body.get("target", "capture")
    target_id = body.get("target_id")
    deep = bool(body.get("deep", False))

    c = store.get(capture_id) if capture_id else None
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")

    context_obj: dict[str, Any] = {"capture": _capture_brief(c)}

    if target == "capture":
        context_obj["context"] = build_capture_context(c.stats, _alert_dict_list(c), {"filename": c.filename})
        prompt = (
            "Analiza esta captura de red de forma integral. Identifica patrones de tráfico, posibles riesgos, "
            "anomalías y comportamiento de hosts destacados. Entrega el análisis estructurado."
        )
    elif target == "flow":
        f = c.flows.get(target_id) if target_id else None
        if not f:
            raise HTTPException(404, detail="Flujo no encontrado.")
        context_obj["flow"] = {
            "flow_id": f.flow_id,
            "protocol": f.protocol,
            "src": f"{f.src_ip}:{f.src_port}",
            "dst": f"{f.dst_ip}:{f.dst_port}",
            "packets": f.packets,
            "bytes": f.bytes,
            "duration": round(max(f.last_seen - f.first_seen, 0), 3),
            "flags": {"SYN": f.syn, "FIN": f.fin, "RST": f.rst},
            "has_anomaly": f.has_anomaly,
            "severity": f.severity,
        }
        prompt = (
            f"Analiza el flujo {f.flow_id}. ¿Qué representa? ¿Es normal o sospechoso? "
            "Explica patrón, posibles riesgos y evidencia."
        )
    elif target == "packet":
        try:
            idx = int(target_id) if target_id is not None else -1
        except ValueError:
            raise HTTPException(400, detail="target_id inválido.")
        if idx < 0 or idx >= len(c.packets):
            raise HTTPException(404, detail="Paquete fuera de rango.")
        p = c.packets[idx]
        layers = packet_to_layers(p.raw, c.linktype)
        context_obj["packet"] = {
            "index": idx,
            "time": time_str(p.timestamp),
            "length": p.length,
            "src": f"{p.src_ip}:{p.src_port}" if p.src_port else p.src_ip,
            "dst": f"{p.dst_ip}:{p.dst_port}" if p.dst_port else p.dst_ip,
            "protocol": p.protocol,
            "flags": p.flags,
            "info": p.info,
            "layers": layers[:6],
            "hex_dump": hex_dump(p.raw, max_bytes=512),
        }
        prompt = (
            "Explica este paquete en detalle: qué hace, qué campos son relevantes, qué relevancia tiene "
            "en seguridad y si parece normal o sospechoso."
        )
    elif target == "host":
        h = c.hosts.get(target_id) if target_id else None
        if not h:
            raise HTTPException(404, detail="Host no encontrado.")
        context_obj["host"] = {
            "ip": h.ip,
            "mac": h.mac,
            "is_private": _is_private_ip(h.ip),
            "packets_sent": h.packets_sent,
            "packets_recv": h.packets_recv,
            "bytes_sent": h.bytes_sent,
            "bytes_recv": h.bytes_recv,
            "peers": len(h.peers),
            "protocols": sorted(list(h.protocols)),
            "role_hint": role_hint(h),
        }
        prompt = (
            f"Analiza el comportamiento del host {h.ip}. ¿Qué rol parece tener? ¿Hay indicios de actividad anómala?"
        )
    else:
        raise HTTPException(400, detail="target inválido.")

    if deep:
        prompt += "\n\nHaz un análisis profundo: hipótesis alternativas, contraindicios, signals adicionales que verificar."

    messages = [
        {
            "role": "user",
            "content": (
                "CONTEXTO (JSON):\n"
                + (
                    context_obj.get("context")
                    or str({k: v for k, v in context_obj.items() if k != "context"})
                )
                + "\n\nTAREA:\n"
                + prompt
            ),
        }
    ]
    try:
        result = chat_complete(messages, temperature=0.2, max_tokens=1800)
    except GroqUnavailable as e:
        raise HTTPException(503, detail=str(e))
    except Exception as e:
        raise HTTPException(502, detail=f"Error al llamar a Groq: {e}")

    return {
        "summary": result["content"],
        "model": result["model"],
        "usage": result.get("usage"),
    }


@router.post("/chat")
def chat(body: dict[str, Any]) -> dict[str, Any]:
    capture_id = body.get("capture_id")
    msg = (body.get("message") or "").strip()
    ctx = body.get("context") or {}
    if not capture_id or not msg:
        raise HTTPException(400, detail="capture_id y message son obligatorios.")
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")

    capture_context = build_capture_context(
        c.stats,
        _alert_dict_list(c),
        {"filename": c.filename, "packets": len(c.packets), "truncated": c.truncated},
    )
    extra = ""
    if ctx.get("selected_packet") is not None:
        idx = int(ctx["selected_packet"])
        if 0 <= idx < len(c.packets):
            p = c.packets[idx]
            extra += (
                f"\n\n[Paquete seleccionado #{idx}] {p.protocol} {p.src_ip}:{p.src_port} → {p.dst_ip}:{p.dst_port} flags={p.flags} info={p.info}"
            )
    if ctx.get("selected_flow"):
        f = c.flows.get(ctx["selected_flow"])
        if f:
            extra += (
                f"\n\n[Flujo seleccionado] {f.flow_id} pkts={f.packets} bytes={f.bytes} flags SYN={f.syn} FIN={f.fin} RST={f.rst}"
            )
    if ctx.get("filter"):
        extra += f"\n\n[Filtro activo] {ctx['filter']}"

    history_msgs: list[dict[str, str]] = []
    for h in c.chat_history[-12:]:
        history_msgs.append({"role": h.role, "content": h.content})

    user_content = (
        "CONTEXTO DE CAPTURA (JSON resumen):\n"
        + capture_context
        + extra
        + "\n\nPREGUNTA DEL USUARIO:\n"
        + msg
        + "\n\nResponde con secciones cortas (Resumen, Hallazgos, Evidencia, Confianza, Próximos pasos). "
        "Si conviene, cita índices de paquete o flujos concretos para que el usuario pueda saltar a ellos."
    )

    messages = history_msgs + [{"role": "user", "content": user_content}]

    try:
        result = chat_complete(messages, temperature=0.25, max_tokens=1600)
    except GroqUnavailable as e:
        raise HTTPException(503, detail=str(e))
    except Exception as e:
        raise HTTPException(502, detail=f"Error al llamar a Groq: {e}")

    c.chat_history.append(ChatMessage(role="user", content=msg, timestamp=time.time()))
    c.chat_history.append(ChatMessage(role="assistant", content=result["content"], timestamp=time.time()))

    return {"reply": result["content"], "model": result["model"], "usage": result.get("usage")}


@router.get("/chat/{capture_id}/history")
def chat_history(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    return {
        "history": [
            {"role": m.role, "content": m.content, "timestamp": m.timestamp}
            for m in c.chat_history
        ]
    }


@router.delete("/chat/{capture_id}/history")
def clear_history(capture_id: str) -> dict[str, Any]:
    c = store.get(capture_id)
    if not c:
        raise HTTPException(404, detail="Captura no encontrada.")
    c.chat_history.clear()
    return {"ok": True}


@router.get("/health")
def ai_health() -> dict[str, Any]:
    from ..core.config import settings
    return {"configured": bool(settings.groq_api_key), "model": settings.groq_model}
