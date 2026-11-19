"""Application Configuration Module.

Reads environment variables with defensive defaults and validated types.
"""

from __future__ import annotations

import json
import os
from typing import List

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )

        ENVIRONMENT: str = "development"
        PROJECT_NAME: str = "AETHER Air Quality Intelligence"
        VERSION: str = "0.1.0"
        API_V1_STR: str = "/api/v1"
        DEBUG: bool = True

        # Security & CORS
        CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
        SECRET_KEY: str = "default-insecure-dev-key-change-in-production"

        # Runtime AI Configuration (Gemini API)
        GEMINI_API_KEY: str = ""
        GEMINI_MODEL: str = "gemini-2.5-flash"
        GEMINI_TIMEOUT_SECONDS: float = 4.0

        # Circuit Breaker & Resilience
        CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 3
        CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS: float = 30.0

        # Persistence & Cache
        DATABASE_URL: str = (
            "postgresql+asyncpg://aether:aether_secret_dev@localhost:5432/aether_db"
        )
        REDIS_URL: str = "redis://localhost:6379/0"
        CACHE_TTL_SECONDS: int = 600

        # Spatiotemporal Estimation (IDW)
        IDW_POWER: float = 2.0
        IDW_MAX_RADIUS_KM: float = 25.0

except ImportError:
    from pydantic import BaseModel, Field

    class Settings(BaseModel):  # type: ignore[no-redef]
        ENVIRONMENT: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
        PROJECT_NAME: str = Field(
            default_factory=lambda: os.getenv("PROJECT_NAME", "AETHER Air Quality Intelligence")
        )
        VERSION: str = Field(default_factory=lambda: os.getenv("VERSION", "0.1.0"))
        API_V1_STR: str = Field(default_factory=lambda: os.getenv("API_V1_STR", "/api/v1"))
        DEBUG: bool = Field(default_factory=lambda: os.getenv("DEBUG", "true").lower() == "true")

        # Security & CORS
        CORS_ORIGINS: List[str] = Field(
            default_factory=lambda: json.loads(
                os.getenv("CORS_ORIGINS", '["http://localhost:3000","http://127.0.0.1:3000"]')
            )
        )
        SECRET_KEY: str = Field(
            default_factory=lambda: os.getenv(
                "SECRET_KEY", "default-insecure-dev-key-change-in-production"
            )
        )

        # Runtime AI Configuration (Gemini API)
        GEMINI_API_KEY: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
        GEMINI_MODEL: str = Field(
            default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        )
        GEMINI_TIMEOUT_SECONDS: float = Field(
            default_factory=lambda: float(os.getenv("GEMINI_TIMEOUT_SECONDS", "4.0"))
        )

        # Circuit Breaker & Resilience
        CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = Field(
            default_factory=lambda: int(os.getenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "3"))
        )
        CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS: float = Field(
            default_factory=lambda: float(
                os.getenv("CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS", "30.0")
            )
        )

        # Persistence & Cache
        DATABASE_URL: str = Field(
            default_factory=lambda: os.getenv(
                "DATABASE_URL",
                "postgresql+asyncpg://aether:aether_secret_dev@localhost:5432/aether_db",
            )
        )
        REDIS_URL: str = Field(
            default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0")
        )
        CACHE_TTL_SECONDS: int = Field(
            default_factory=lambda: int(os.getenv("CACHE_TTL_SECONDS", "600"))
        )

        # Spatiotemporal Estimation (IDW)
        IDW_POWER: float = Field(
            default_factory=lambda: float(os.getenv("IDW_POWER", "2.0"))
        )
        IDW_MAX_RADIUS_KM: float = Field(
            default_factory=lambda: float(os.getenv("IDW_MAX_RADIUS_KM", "25.0"))
        )


settings = Settings()
