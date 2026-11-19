# AETHER Backend API Service (`aether-api`)

FastAPI backend service powering the AETHER Urban Air Quality Intelligence platform.

## Architecture Highlights
- **FastAPI Core**: Async route handlers and lifespan management.
- **Pydantic v2**: Strict schema validation for all inputs and outputs.
- **Resilience Engine**: Custom asynchronous Circuit Breaker with bounded timeouts and deterministic fallback.
- **Persistence & Cache**: SQLAlchemy 2.0 with GeoAlchemy2 for PostGIS spatial queries, and Redis for station caching.
- **AI Runtime**: Google GenAI SDK integration with configurable models (`gemini-2.5-flash`).

## Local Development Commands (with uv)

```bash
# Sync dependencies
uv sync

# Run tests
uv run pytest

# Start development server
uv run uvicorn app.main:app --reload --port 8000
```

For platform-wide configuration and Docker Compose setup, see the [Root README](../../README.md).
