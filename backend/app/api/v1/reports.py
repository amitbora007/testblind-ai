import json
import uuid
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context
from app.core.database import get_db
from app.models.scan import Mutation, ScanJob
from app.services.regression_service import RegressionService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary", response_model=Dict[str, Any])
async def get_reports_summary(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    project_id: Optional[uuid.UUID] = Query(None, description="Optional project ID"),
) -> Dict[str, Any]:
    """Retrieve aggregated mutation kill rates, coverage integrity, and flakiness metrics."""
    unified = await RegressionService.aggregate_unified_report(
        db=db,
        organization_id=tenant.organization_id,
        project_id=project_id,
    )
    return {
        "overall_mutation_score": unified["overall_mutation_score"],
        "semantic_code_coverage": unified["semantic_code_coverage"],
        "line_coverage": unified["line_coverage"],
        "branch_coverage": unified["branch_coverage"],
        "flakiness_index": unified["flakiness_index"],
        "unstable_tests": unified.get("unstable_tests", 0),
        "mean_time_to_kill_seconds": unified["mean_time_to_kill_seconds"],
        "operators": unified["mutation_effectiveness"]["operators"],
    }


@router.get("/unified", response_model=Dict[str, Any])
async def get_unified_report(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    project_id: Optional[uuid.UUID] = Query(None, description="Filter by project ID"),
) -> Dict[str, Any]:
    """
    Comprehensive regression protection report uniting mutation effectiveness,
    surviving mutations, test generation stats, execution history, and recurring incidents.
    """
    return await RegressionService.aggregate_unified_report(
        db=db,
        organization_id=tenant.organization_id,
        project_id=project_id,
    )


@router.get("/export")
async def export_report(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = Query("json", description="Export format: csv or json"),
    project_id: Optional[uuid.UUID] = Query(None, description="Filter by project ID"),
) -> Response:
    """Export unified regression report in CSV or JSON format."""
    report_data = await RegressionService.aggregate_unified_report(
        db=db,
        organization_id=tenant.organization_id,
        project_id=project_id,
    )

    fmt = format.lower().strip()
    if fmt == "csv":
        csv_content = RegressionService.export_csv(report_data)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="testblind_unified_report.csv"'},
        )
    elif fmt == "json":
        json_content = json.dumps(report_data, indent=2)
        return Response(
            content=json_content,
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="testblind_unified_report.json"'},
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{format}'. Supported formats: csv, json.",
        )
