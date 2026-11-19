"""Health check, readiness, and diagnostics endpoint handlers."""

from __future__ import annotations

from datetime import datetime, timezone
import time
from typing import Dict

from fastapi import APIRouter, Response, status

from app.core.circuit import CircuitBreaker
from app.core.config import settings
from app.schemas.health import (
    ComponentStatus,
    HealthCheckResponse,
    ReadinessResponse,
    ServiceInfoResponse,
)

router = APIRouter(tags=["Health & System"])

# Singleton circuit breaker instance for AI provider
gemini_circuit_breaker = CircuitBreaker(
    name="gemini-provider",
    failure_threshold=settings.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    recovery_timeout_seconds=settings.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS,
    request_timeout_seconds=settings.GEMINI_TIMEOUT_SECONDS,
)


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Liveness Probe",
    description="Returns 200 OK if the application process is running and responding.",
)
async def health_liveness() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness Probe",
    description="Checks downstream connections (PostGIS Database, Redis Cache). Returns 503 if critical dependencies are unreachable.",
)
async def health_readiness(response: Response) -> ReadinessResponse:
    components: Dict[str, ComponentStatus] = {}
    is_ready = True

    # 1. Check PostgreSQL + PostGIS connectivity
    db_start = time.perf_counter()
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text

        engine = create_async_engine(
            settings.DATABASE_URL,
            connect_args={"timeout": 2.0},
        )
        async with engine.connect() as conn:
            # Check PostGIS extension
            result = await conn.execute(text("SELECT PostGIS_Version();"))
            row = result.fetchone()
            postgis_ver = row[0] if row else "unknown"
            latency = (time.perf_counter() - db_start) * 1000
            components["database"] = ComponentStatus(
                status="connected",
                latency_ms=round(latency, 2),
                details=f"PostGIS version {postgis_ver}",
            )
        await engine.dispose()
    except Exception as exc:
        is_ready = False
        components["database"] = ComponentStatus(
            status="disconnected",
            details=f"Database check failed: {type(exc).__name__}",
        )

    # 2. Check Redis connectivity
    redis_start = time.perf_counter()
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2.0)
        pong = await client.ping()
        latency = (time.perf_counter() - redis_start) * 1000
        await client.aclose()
        if pong:
            components["redis"] = ComponentStatus(
                status="connected",
                latency_ms=round(latency, 2),
                details="PONG received",
            )
        else:
            components["redis"] = ComponentStatus(
                status="degraded",
                details="Unexpected ping response",
            )
    except Exception as exc:
        # Cache degradation is non-critical for bootstrapping, but reported
        components["redis"] = ComponentStatus(
            status="disconnected",
            details=f"Redis check failed: {type(exc).__name__}",
        )

    # 3. Check AI Provider Configuration
    ai_status = "configured" if settings.GEMINI_API_KEY else "key_not_set"
    components["ai_provider"] = ComponentStatus(
        status="ready" if settings.GEMINI_API_KEY else "degraded",
        details=f"Model: {settings.GEMINI_MODEL} ({ai_status})",
    )

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        ready=is_ready,
        service=settings.PROJECT_NAME,
        timestamp=datetime.now(timezone.utc).isoformat(),
        components=components,
    )


@router.get(
    "/info",
    response_model=ServiceInfoResponse,
    summary="System Diagnostics & Info",
    description="Returns public system metadata, configured Gemini model, and circuit breaker operational metrics.",
)
async def service_info() -> ServiceInfoResponse:
    return ServiceInfoResponse(
        name=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
        gemini_model=settings.GEMINI_MODEL,
        gemini_timeout_seconds=settings.GEMINI_TIMEOUT_SECONDS,
        circuit_breaker=gemini_circuit_breaker.status_summary,
    )
