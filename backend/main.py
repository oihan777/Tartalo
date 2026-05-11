"""Entry point that re-exports the FastAPI app for deployment tooling."""

from app.main import app  # noqa: F401

__all__ = ["app"]
