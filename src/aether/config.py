"""Runtime configuration, read once from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    cache_ttl_seconds: int = 600
    rate_limit_per_minute: int = 30
    request_timeout_seconds: int = 8

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            gemini_api_key=os.environ.get("GEMINI_API_KEY", "").strip(),
            gemini_model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip(),
            cache_ttl_seconds=_int("CACHE_TTL_SECONDS", 600),
            rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 30),
            request_timeout_seconds=_int("REQUEST_TIMEOUT_SECONDS", 8),
        )
