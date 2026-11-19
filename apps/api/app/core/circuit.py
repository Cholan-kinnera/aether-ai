"""Circuit Breaker and Resilience Management for External Services.

Provides bounded provider timeouts, failure tracking, and deterministic failover.
Per design specification, failover is bounded and resilient, avoiding unbounded stalls
under network partitions, upstream rate limits (HTTP 429), or service degradations.
"""

from __future__ import annotations

import asyncio
from enum import Enum
import time
from typing import Any, Callable, Coroutine, Optional


class CircuitState(str, Enum):
    CLOSED = "CLOSED"        # Normal operation: requests pass through to primary provider
    OPEN = "OPEN"            # Tripped: primary calls fail-fast directly to fallback
    HALF_OPEN = "HALF_OPEN"  # Testing: probationary trial of primary provider


class CircuitBreakerOpenException(Exception):
    """Raised when an operation is attempted while the circuit breaker is OPEN."""
    pass


class CircuitBreaker:
    """Thread-safe and async-safe Circuit Breaker."""

    def __init__(
        self,
        name: str = "gemini-provider",
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 30.0,
        request_timeout_seconds: float = 4.0,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.request_timeout_seconds = request_timeout_seconds

        self._state: CircuitState = CircuitState.CLOSED
        self._consecutive_failures: int = 0
        self._last_state_change: float = time.monotonic()
        self._last_failure_time: Optional[float] = None
        self._last_error_message: Optional[str] = None
        self._total_requests: int = 0
        self._total_fallbacks: int = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Returns the current state, evaluating automatic OPEN -> HALF_OPEN transitions."""
        if self._state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._last_state_change
            if elapsed >= self.recovery_timeout_seconds:
                self._state = CircuitState.HALF_OPEN
        return self._state

    @property
    def status_summary(self) -> dict[str, Any]:
        """Provides operational metrics for health and diagnostics."""
        return {
            "name": self.name,
            "state": self.state.value,
            "consecutive_failures": self._consecutive_failures,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout_seconds": self.recovery_timeout_seconds,
            "request_timeout_seconds": self.request_timeout_seconds,
            "total_requests": self._total_requests,
            "total_fallbacks": self._total_fallbacks,
            "last_error": self._last_error_message,
        }

    async def record_success(self) -> None:
        """Records a successful primary provider call, resetting failure counters."""
        async with self._lock:
            self._consecutive_failures = 0
            self._last_error_message = None
            if self._state != CircuitState.CLOSED:
                self._state = CircuitState.CLOSED
                self._last_state_change = time.monotonic()

    async def record_failure(self, error: Exception) -> None:
        """Records a primary provider failure, tripping circuit if threshold reached."""
        async with self._lock:
            self._consecutive_failures += 1
            self._last_failure_time = time.monotonic()
            self._last_error_message = str(error)
            self._total_fallbacks += 1

            if self._consecutive_failures >= self.failure_threshold:
                if self._state != CircuitState.OPEN:
                    self._state = CircuitState.OPEN
                    self._last_state_change = time.monotonic()

    async def execute_with_fallback(
        self,
        primary_fn: Callable[..., Coroutine[Any, Any, Any]],
        fallback_fn: Callable[..., Coroutine[Any, Any, Any]],
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, bool]:
        """Executes primary_fn with bounded timeout; on failure or open circuit, routes to fallback.

        Returns:
            tuple[Any, bool]: (result, used_fallback)
        """
        async with self._lock:
            self._total_requests += 1

        current_state = self.state

        if current_state == CircuitState.OPEN:
            # Circuit is OPEN: skip primary directly to fallback without delay
            async with self._lock:
                self._total_fallbacks += 1
            fallback_result = await fallback_fn(*args, **kwargs)
            return fallback_result, True

        # Circuit is CLOSED or HALF_OPEN: attempt primary within bounded timeout
        try:
            primary_result = await asyncio.wait_for(
                primary_fn(*args, **kwargs),
                timeout=self.request_timeout_seconds,
            )
            await self.record_success()
            return primary_result, False
        except Exception as exc:
            await self.record_failure(exc)
            fallback_result = await fallback_fn(*args, **kwargs)
            return fallback_result, True
