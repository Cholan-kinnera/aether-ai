"""Health check, readiness, and diagnostics schemas."""

from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Overall service status, typically 'healthy' or 'degraded'")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service semantic version")
    timestamp: str = Field(..., description="ISO 8601 server timestamp")


class ComponentStatus(BaseModel):
    status: str = Field(..., description="'connected', 'disconnected', 'degraded', or 'skipped'")
    latency_ms: Optional[float] = Field(None, description="Round-trip latency in milliseconds")
    details: Optional[str] = Field(None, description="Diagnostic error or configuration details")


class ReadinessResponse(BaseModel):
    ready: bool = Field(..., description="Whether the service is ready to accept user traffic")
    service: str = Field(..., description="Service name")
    timestamp: str = Field(..., description="ISO 8601 server timestamp")
    components: Dict[str, ComponentStatus] = Field(
        ..., description="Health status of external dependencies (database, cache, ai)"
    )


class ServiceInfoResponse(BaseModel):
    name: str
    version: str
    environment: str
    debug: bool
    gemini_model: str
    gemini_timeout_seconds: float
    circuit_breaker: Dict[str, Any]
