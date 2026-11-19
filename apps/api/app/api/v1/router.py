"""AETHER API v1 Central Router."""

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_v1_router = APIRouter()

# Mount health & diagnostics endpoints
api_v1_router.include_router(health.router)

# Placeholders for future Milestone modules:
# api_v1_router.include_router(aqi.router, prefix="/aqi", tags=["AQI Intelligence"])
# api_v1_router.include_router(copilot.router, prefix="/copilot", tags=["GenAI Copilot"])
# api_v1_router.include_router(routine.router, prefix="/routine", tags=["Routine Planner"])
# api_v1_router.include_router(indoor.router, prefix="/indoor", tags=["Indoor Air Optimizer"])
# api_v1_router.include_router(simulator.router, prefix="/simulator", tags=["Action Simulator"])
# api_v1_router.include_router(family.router, prefix="/family", tags=["Family Protection"])
