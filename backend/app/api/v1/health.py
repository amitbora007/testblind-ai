from typing import Annotated, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/healthz", response_model=Dict[str, str])
async def health_check() -> Dict[str, str]:
    """Liveness probe: verifies web server is alive."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/readyz", response_model=Dict[str, str])
async def readiness_check(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Dict[str, str]:
    """Readiness probe: verifies PostgreSQL database connectivity."""
    try:
        result = await db.execute(text("SELECT 1"))
        val = result.scalar()
        if val != 1:
            raise ValueError("Unexpected query response")
        return {
            "status": "ready",
            "database": "connected",
            "service": settings.PROJECT_NAME,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: Database connection failed: {str(exc)}",
        )
