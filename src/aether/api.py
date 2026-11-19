"""FastAPI application: JSON API plus the static accessible front end."""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .advisor import Advisor, GeminiAdvisor
from .airdata import AirDataError, AirDataProvider, LocationNotFoundError, OpenMeteoClient
from .config import Settings
from .models import Activity, AdviceRequest, AdviceResponse
from .profiles import extract_from_note
from .rules import decide
from .security import SECURITY_HEADERS, RateLimiter

STATIC_DIR = Path(__file__).parent / "static"
DISCLAIMER = (
    "General guidance based on public air-quality data, not medical advice. "
    "Follow your doctor's plan if you have a health condition."
)


def create_app(
    settings: Settings | None = None,
    air: AirDataProvider | None = None,
    advisor: Advisor | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = httpx.AsyncClient(timeout=settings.request_timeout_seconds)
        app.state.air = air or OpenMeteoClient(client, settings.cache_ttl_seconds)
        app.state.advisor = advisor or GeminiAdvisor(
            settings.gemini_api_key, settings.gemini_model, client
        )
        try:
            yield
        finally:
            await client.aclose()

    app = FastAPI(title="AETHER", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(AirDataError)
    async def air_error(_: Request, exc: AirDataError) -> JSONResponse:
        status = 404 if isinstance(exc, LocationNotFoundError) else 502
        return JSONResponse({"detail": str(exc)}, status_code=status)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/advice", response_model=AdviceResponse)
    async def advice(body: AdviceRequest, request: Request) -> AdviceResponse:
        client_id = request.client.host if request.client else "unknown"
        retry_after = limiter.check(client_id)
        if retry_after:
            raise HTTPException(
                429,
                "too many requests, please slow down",
                headers={"Retry-After": str(int(retry_after))},
            )
        note_groups, note_activity = extract_from_note(body.note)
        groups = set(body.groups) | note_groups
        activity = body.activity or note_activity or Activity.WALK
        snapshot = await request.app.state.air.snapshot(
            location=body.location, latitude=body.latitude, longitude=body.longitude
        )
        decision = decide(snapshot, groups, activity)
        explanation, source = await request.app.state.advisor.explain(decision, body.note)
        return AdviceResponse(
            location=snapshot.location_name,
            observed_at=snapshot.observed_at,
            profile={"groups": sorted(g.value for g in groups), "activity": activity.value},
            decision=decision,
            explanation=explanation,
            explanation_source=source,
            hourly=snapshot.hourly,
            disclaimer=DISCLAIMER,
        )

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app


app = create_app()
