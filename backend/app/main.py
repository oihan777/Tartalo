from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, ORJSONResponse
from fastapi.staticfiles import StaticFiles

from .api import ai as ai_api
from .api import alerts as alerts_api
from .api import bookmarks as bookmarks_api
from .api import captures as captures_api
from .api import flows as flows_api
from .api import hosts as hosts_api
from .api import packets as packets_api
from .core.config import settings


def _frontend_dist() -> Path | None:
    """Locate the built frontend (frontend/dist) relative to the backend."""
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
        Path(__file__).resolve().parent.parent / "frontend_dist",
        Path("/app/frontend_dist"),
    ]
    env = os.getenv("TARTALO_FRONTEND_DIST")
    if env:
        candidates.insert(0, Path(env))
    for c in candidates:
        if c.exists() and (c / "index.html").exists():
            return c
    return None


def create_app() -> FastAPI:
    app = FastAPI(
        title="Tartalo API",
        version="0.1.0",
        description="Backend de Tartalo - análisis de red basado en PCAP/PCAPNG con IA.",
        default_response_class=ORJSONResponse,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {
            "status": "ok",
            "name": settings.app_name,
            "groq_configured": bool(settings.groq_api_key),
            "model": settings.groq_model,
        }

    app.include_router(captures_api.router)
    app.include_router(packets_api.router)
    app.include_router(flows_api.router)
    app.include_router(hosts_api.router)
    app.include_router(alerts_api.router)
    app.include_router(ai_api.router)
    app.include_router(bookmarks_api.router)

    dist = _frontend_dist()
    if dist is not None:
        app.mount("/assets", StaticFiles(directory=str(dist / "assets")), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str):
            file = dist / full_path
            if full_path and file.is_file():
                return FileResponse(str(file))
            return FileResponse(str(dist / "index.html"))
    else:
        @app.get("/")
        def root() -> dict:
            return {"name": "Tartalo", "docs": "/docs", "health": "/api/health"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
