"""FastAPI application: JSON API plus the static accessible front end."""

from __future__ import annotations

import json
import logging
import re
import secrets
import time
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .advisor import Advisor, GeminiAdvisor, rules_briefing
from .airdata import (
    AirDataError,
    AirDataProvider,
    LocationNotFoundError,
    OpenMeteoClient,
    TTLCache,
)
from .config import Settings
from .models import Briefing, PlanRequest, PlanResponse
from .security import SECURITY_HEADERS, RateLimiter, client_ip
from .service import build_plan

STATIC_DIR = Path(__file__).parent / "static"
BRIEFING_TTL_SECONDS = 300
_REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
log = logging.getLogger("aether")


def _log(**fields: object) -> None:
    """One JSON line per event; never includes request bodies or secrets."""
    log.info(json.dumps(fields, separators=(",", ":")))


def create_app(
    settings: Settings | None = None,
    air: AirDataProvider | None = None,
    advisor: Advisor | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    limiter = RateLimiter(settings.rate_limit_per_minute)
    pending: TTLCache[tuple[PlanResponse, str | None]] = TTLCache(BRIEFING_TTL_SECONDS)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        timeout = httpx.Timeout(settings.request_timeout_seconds, connect=4)
        client = httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "aether-ai"})
        app.state.air = air or OpenMeteoClient(client, settings.cache_ttl_seconds)
        app.state.advisor = advisor or GeminiAdvisor(
            settings.gemini_api_key,
            settings.gemini_model,
            client,
            settings.gemini_calls_per_minute,
        )
        try:
            yield
        finally:
            await client.aclose()

    app = FastAPI(title="AETHER", version="2.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def observe(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex
        started = time.perf_counter()
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        response.headers["X-Request-ID"] = request_id
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            _log(
                event="request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                ms=round((time.perf_counter() - started) * 1000, 1),
            )
        return response

    @app.exception_handler(AirDataError)
    async def air_error(_: Request, exc: AirDataError) -> JSONResponse:
        status = 404 if isinstance(exc, LocationNotFoundError) else 502
        return JSONResponse({"detail": str(exc)}, status_code=status)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    def throttle(request: Request) -> None:
        peer = request.client.host if request.client else None
        who = client_ip(peer, request.headers.get("x-forwarded-for"), settings.trusted_proxy_hops)
        retry_after = limiter.check(who)
        if retry_after:
            raise HTTPException(
                429,
                "too many requests, please slow down",
                headers={"Retry-After": str(int(retry_after))},
            )

    @app.post("/api/plan")
    async def plan(body: PlanRequest, request: Request) -> PlanResponse:
        """Deterministic plan, returned at once with a rule-based briefing."""
        throttle(request)
        snapshot = await request.app.state.air.snapshot(
            location=body.location, latitude=body.latitude, longitude=body.longitude
        )
        result = build_plan(snapshot, body)
        briefing_id = secrets.token_urlsafe(16)
        pending.put(briefing_id, (result, body.note))
        return result.model_copy(
            update={"explanation": rules_briefing(result), "briefing_id": briefing_id}
        )

    @app.post("/api/briefing/{briefing_id}")
    async def briefing(briefing_id: str, request: Request) -> Briefing:
        """Single-use AI briefing for a plan created in the last few minutes."""
        throttle(request)
        entry = pending.pop(briefing_id)
        if entry is None:
            raise HTTPException(404, "briefing expired, please plan again")
        result, note = entry
        text, source = await request.app.state.advisor.explain(result, note)
        return Briefing(explanation=text, explanation_source=source)

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app


app = create_app()
