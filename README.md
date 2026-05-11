# Tartalo

> _"El ojo único de Tartalo, observando el tráfico antes de que cause daño."_

**Tartalo** es una herramienta profesional de análisis de red diseñada para sustituir y superar a Wireshark en claridad, comodidad y experiencia de uso. Abre capturas reales en `PCAP`/`PCAPNG`, parsea hasta la capa de aplicación, detecta anomalías y se complementa con un analista IA conversacional basado en Groq (`llama-3.3-70b-versatile`).

La estética se inspira en la mitología vasca: maderas, tierras, verdes mohosos y el gran ojo de Tartalo como símbolo central de vigilancia y profundidad técnica.

## Características

- **Motor de paquetes**: árbol de protocolos por capas, decodificación de campos, flags, hexdump, payload textual, detección heurística de protocolos de aplicación (HTTP, DNS, TLS, ARP, ICMP, etc.).
- **Flujos y conversaciones**: agrupación por 5-tupla, reconstrucción de stream cuando hay payload, navegación rápida entre paquetes relacionados.
- **Hosts y top talkers**: perfil por IP/MAC con peers, protocolos, dirección dominante de tráfico, marcas de IP privada/pública.
- **Alertas inteligentes**: escaneos verticales y horizontales, SYN floods, beaconing C2 por regularidad temporal, DNS tunneling, ARP spoofing, exfiltración a IPs públicas en puertos atípicos, tráfico en claro (HTTP/FTP/Telnet/POP/SMTP/IMAP).
- **Dashboard ejecutivo**: KPIs, timeline, distribución de protocolos, puertos dominantes, conversaciones destacadas, alertas por severidad.
- **Chat IA con contexto**: pregunta en lenguaje natural sobre la captura, el paquete seleccionado, el flujo o el filtro activo. Tartalo cita evidencia y nivel de confianza.
- **Análisis IA específico**: explica un paquete, un flujo, un host o la captura completa, con modo profundo bajo demanda.
- **Filtros, paleta de comandos (`⌘K`), marcadores, notas** y atajos para investigar rápido.
- **Diseño rústico-elegante**: marrones, verdes, sombras orgánicas, tipografía display tipo manuscrito, accesibilidad de contraste alta.

## Arquitectura

```
tartalo/
├── backend/          # FastAPI + Scapy (parseo PCAP/PCAPNG, anomalías, IA Groq)
│   └── app/
│       ├── api/      # endpoints REST (captures, packets, flows, hosts, alerts, ai, bookmarks)
│       ├── services/ # pcap_parser, analyzer, groq_client
│       ├── core/     # config, store en memoria
│       └── main.py
└── frontend/         # React + Vite + Tailwind (UI Tartalo)
    └── src/
        ├── pages/    # Dashboard, Packets, Flows, Hosts, Alerts, Chat, Bookmarks, Settings
        ├── components/
        ├── lib/      # cliente API
        └── store/    # estado zustand
```

## Requisitos

- Python 3.11+
- Node.js 20+
- Una `GROQ_API_KEY` (gratis en https://console.groq.com/keys) para habilitar el chat y el análisis IA.

## Ejecutar en local

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
export GROQ_API_KEY="..."    # opcional para activar IA
python -m app.main             # arranca uvicorn en :8000
```

API en `http://localhost:8000`. Documentación interactiva en `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev   # vite en :5173
```

Por defecto el frontend en `localhost` apunta al backend en `http://localhost:8000`. Para apuntar a otro backend, define la variable `VITE_API_BASE` antes del `npm run build` o `npm run dev`.

## Endpoints clave

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/captures` | Subir un PCAP/PCAPNG |
| `GET` | `/api/captures` | Listar capturas |
| `GET` | `/api/captures/{id}/stats` | KPIs + timeline + top talkers |
| `GET` | `/api/captures/{id}/packets` | Listar y filtrar paquetes |
| `GET` | `/api/captures/{id}/packets/{i}` | Detalle, árbol de capas, hexdump |
| `GET` | `/api/captures/{id}/flows` | Flujos y conversaciones |
| `GET` | `/api/captures/{id}/hosts` | Perfiles de host |
| `GET` | `/api/captures/{id}/alerts` | Alertas/anomalías |
| `POST` | `/api/ai/analyze` | Análisis IA de captura/flujo/paquete/host |
| `POST` | `/api/ai/chat` | Chat IA con contexto persistente |

## Detección de anomalías (resumen)

| Categoría | Heurística |
|---|---|
| Escaneo vertical | ≥20 puertos SYN/UDP distintos de A → B |
| Escaneo horizontal | ≥15 destinos SYN distintos en un mismo puerto |
| SYN flood | ≥30 SYN sin FIN/RST en un flujo |
| Beaconing C2 | ≥8 paquetes con intervalo regular (CV<0.2) |
| DNS tunneling | ≥3 consultas con nombre ≥60 chars |
| Cleartext sensible | HTTP/FTP/Telnet/POP/SMTP/IMAP con ≥5 paquetes |
| Egress a IP pública | >1 MB en puertos no estándar |
| ARP spoofing | ≥2 MACs distintas anuncian la misma IP |

## Estado

Tartalo es funcional end-to-end y está pensado como producto, no como demo. Las extensiones futuras pertinentes incluyen capturas en vivo, exportación de PDF para auditoría, mapa de relaciones (force-directed graph) y feeds de reputación externos.
