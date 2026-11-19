"""AETHER Backend FastAPI Application Entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown routines."""
    # Startup: logging and environment confirmation
    print(f"[{settings.PROJECT_NAME}] Starting in {settings.ENVIRONMENT} mode...")
    print(f"[{settings.PROJECT_NAME}] Configured Gemini Model: {settings.GEMINI_MODEL}")
    yield
    # Shutdown: connection cleanups
    print(f"[{settings.PROJECT_NAME}] Shutting down cleanly.")


def create_application() -> FastAPI:
    """Application Factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="AI-Powered Urban Air Quality Intelligence Platform",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Cross-Origin Resource Sharing (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API v1 router
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    @app.get("/", include_in_schema=False)
    async def root_redirect() -> JSONResponse:
        return JSONResponse(
            content={
                "message": "Welcome to AETHER Air Quality Intelligence API",
                "version": settings.VERSION,
                "docs": "/docs",
                "health": f"{settings.API_V1_STR}/health",
                "ready": f"{settings.API_V1_STR}/ready",
                "info": f"{settings.API_V1_STR}/info",
            }
        )

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
