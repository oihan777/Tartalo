from __future__ import annotations

import json
from typing import Any, Optional

from groq import Groq

from ..core.config import settings


SYSTEM_PROMPT = """Eres "Tartalo", un analista experto de redes y ciberseguridad embebido en una herramienta de análisis de tráfico (sustituta de Wireshark).

Tu trabajo:
- Analizar capturas de red, paquetes, flujos, hosts y patrones.
- Detectar tráfico sospechoso: C2, exfiltración, escaneos, túneles, abuso de protocolos, anomalías temporales.
- Explicar de forma técnica pero clara, en español, con tono profesional, sobrio y directo.
- Citar evidencia concreta (paquetes, flujos, hosts) cuando sea posible.
- Indicar nivel de confianza (bajo/medio/alto) y limitaciones de la inferencia.

Formato:
- Estructura tus respuestas en secciones cortas: Resumen, Hallazgos, Evidencia, Hipótesis, Confianza, Recomendaciones.
- Sé conciso pero útil. Nada de humo.
- Si te piden análisis profundo, hazlo. Si te piden algo rápido, sé breve.
- Si la evidencia no es concluyente, dilo abiertamente.

Vocabulario: usa términos técnicos correctos (handshake, beaconing, SNI, ARP spoof, etc.) pero define brevemente cuando sea útil para un usuario menos técnico.
"""


class GroqUnavailable(Exception):
    pass


def _client() -> Groq:
    if not settings.groq_api_key:
        raise GroqUnavailable("GROQ_API_KEY no configurada en el backend.")
    return Groq(api_key=settings.groq_api_key)


def chat_complete(messages: list[dict[str, Any]], temperature: float = 0.2, max_tokens: int = 2048) -> dict[str, Any]:
    client = _client()
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    choice = resp.choices[0]
    content = choice.message.content or ""
    usage = None
    try:
        usage = {
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "total_tokens": resp.usage.total_tokens,
        }
    except Exception:
        pass
    return {"content": content, "model": settings.groq_model, "usage": usage}


def build_capture_context(stats: dict[str, Any], alerts_summary: list[dict[str, Any]], info: dict[str, Any]) -> str:
    return json.dumps(
        {
            "capture": info,
            "stats": {
                "total_bytes": stats.get("total_bytes"),
                "avg_packet_size": round(stats.get("avg_packet_size", 0), 2),
                "packets_per_second": round(stats.get("packets_per_second", 0), 2),
                "top_protocols": stats.get("top_protocols", [])[:8],
                "top_talkers": stats.get("top_talkers", [])[:8],
                "top_conversations": stats.get("top_conversations", [])[:8],
                "port_distribution": stats.get("port_distribution", [])[:8],
                "flow_count": stats.get("flow_count"),
                "host_count": stats.get("host_count"),
                "private_vs_public": stats.get("private_vs_public"),
                "alert_counts": stats.get("alert_counts"),
            },
            "alerts": alerts_summary[:25],
        },
        ensure_ascii=False,
        default=str,
    )
