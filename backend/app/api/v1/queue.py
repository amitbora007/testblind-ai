import logging
from typing import Annotated, Any, Dict
from fastapi import APIRouter, Depends

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.models.user import RoleEnum
from app.services.queue_service import queue_engine

router = APIRouter(tags=["Execution Queue & Workers"])
logger = logging.getLogger("testblind.queue_api")


@router.get("/queue/stats", response_model=Dict[str, Any])
async def get_queue_stats(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> Dict[str, Any]:
    """Returns real-time execution queue statistics, worker capacity, and active runs."""
    stats = queue_engine.get_stats()
    # Add tenant-specific active job count for convenience
    active_tenant_count = stats.get("tenant_active_counts", {}).get(str(tenant.organization_id), 0)
    stats["current_tenant_active_jobs"] = active_tenant_count
    return stats


@router.get("/workers/health", response_model=Dict[str, Any])
async def get_workers_health(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> Dict[str, Any]:
    """Health check endpoint for async execution worker fleet."""
    return queue_engine.get_health()
