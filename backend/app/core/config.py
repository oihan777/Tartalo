from __future__ import annotations

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Tartalo"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    cors_origins: str = "*"
    max_upload_mb: int = 200
    max_packets_per_capture: int = 200_000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings(groq_api_key=os.getenv("GROQ_API_KEY", ""))
