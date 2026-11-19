"""Security helpers: response headers and a per-client rate limiter."""
from __future__ import annotations

import time
from collections import deque

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
        "connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}

MAX_TRACKED_CLIENTS = 10_000


class RateLimiter:
    """Sliding-window limiter keyed by client id (in memory, per process)."""

    def __init__(self, limit: int, window_seconds: float = 60.0) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> float:
        """Record a hit. Returns 0 if allowed, otherwise seconds until retry."""
        now = time.monotonic()
        if len(self._hits) >= MAX_TRACKED_CLIENTS and key not in self._hits:
            self._prune(now)
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            return max(1.0, self._window - (now - hits[0]))
        hits.append(now)
        return 0.0

    def _prune(self, now: float) -> None:
        stale = [k for k, h in self._hits.items() if not h or now - h[-1] >= self._window]
        for key in stale:
            del self._hits[key]
