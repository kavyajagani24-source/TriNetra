"""
UrbanEye AI — API v1 Router

Aggregates all v1 routers under a single APIRouter.
Mounted at /api/v1 in main.py.
"""

from fastapi import APIRouter

from app.api.v1 import ai_results, buses, events, health, map, processing, videos

router = APIRouter(prefix="/api/v1")

router.include_router(health.router)
router.include_router(buses.router)
router.include_router(videos.router)
router.include_router(processing.router)
router.include_router(ai_results.router)
router.include_router(events.router)
router.include_router(map.router)
