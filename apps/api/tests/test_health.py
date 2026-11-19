"""Unit and contract tests for Health, Readiness, and Info schemas."""

from __future__ import annotations

import unittest

from app.core.config import settings
from app.schemas.health import (
    HealthCheckResponse,
    ReadinessResponse,
    ServiceInfoResponse,
)


class TestHealthSchemas(unittest.TestCase):
    """Schema validation tests for system diagnostics and probes."""

    def test_health_schema_validation(self) -> None:
        data = {
            "status": "healthy",
            "service": "AETHER Air Quality Intelligence",
            "version": "0.1.0",
            "timestamp": "2026-11-19T10:00:00Z",
        }
        obj = HealthCheckResponse(**data)
        self.assertEqual(obj.status, "healthy")
        self.assertEqual(obj.version, "0.1.0")

    def test_service_info_schema_validation(self) -> None:
        data = {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": "development",
            "debug": True,
            "gemini_model": "gemini-2.5-flash",
            "gemini_timeout_seconds": 4.0,
            "circuit_breaker": {
                "name": "gemini-provider",
                "state": "CLOSED",
                "consecutive_failures": 0,
                "failure_threshold": 3,
                "recovery_timeout_seconds": 30.0,
                "request_timeout_seconds": 4.0,
                "total_requests": 0,
                "total_fallbacks": 0,
                "last_error": None,
            },
        }
        info = ServiceInfoResponse(**data)
        self.assertEqual(info.gemini_model, "gemini-2.5-flash")
        self.assertEqual(info.circuit_breaker["state"], "CLOSED")

    def test_readiness_schema_validation(self) -> None:
        data = {
            "ready": True,
            "service": "AETHER",
            "timestamp": "2026-11-19T10:00:00Z",
            "components": {
                "database": {
                    "status": "connected",
                    "latency_ms": 1.45,
                    "details": "PostGIS version 3.4.2",
                },
                "redis": {
                    "status": "connected",
                    "latency_ms": 0.85,
                    "details": "PONG received",
                },
                "ai_provider": {
                    "status": "ready",
                    "details": "Model: gemini-2.5-flash (configured)",
                },
            },
        }
        readiness = ReadinessResponse(**data)
        self.assertTrue(readiness.ready)
        self.assertEqual(readiness.components["database"].status, "connected")
        self.assertEqual(readiness.components["redis"].status, "connected")


if __name__ == "__main__":
    unittest.main()
