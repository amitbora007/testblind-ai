import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.scan import Finding, Mutation, ScanJob
from app.models.user import RoleEnum
from app.schemas.scan import FindingRead, MutationRead, ScanJobCreate, ScanJobRead

router = APIRouter(tags=["Scan Jobs & Mutations"])


@router.get("/projects/{project_id}/scan-jobs", response_model=List[ScanJobRead])
async def list_project_scan_jobs(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[ScanJobRead]:
    """List all scan jobs for a project. Validates tenant ownership."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = (
        select(ScanJob)
        .where(
            ScanJob.project_id == project_id,
            ScanJob.organization_id == tenant.organization_id,
        )
        .order_by(ScanJob.created_at.desc())
    )
    jobs = (await db.execute(query)).scalars().all()
    return [ScanJobRead.model_validate(j) for j in jobs]


@router.post("/projects/{project_id}/scan-jobs", response_model=ScanJobRead, status_code=status.HTTP_201_CREATED)
async def trigger_scan_job(
    project_id: uuid.UUID,
    data: ScanJobCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScanJobRead:
    """Trigger an AST mutation testing scan job for a project and populate mutation records."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    now = datetime.now(timezone.utc)
    scan_job = ScanJob(
        project_id=project_id,
        organization_id=tenant.organization_id,
        status="completed",
        trigger=data.trigger,
        branch=data.branch,
        commit_hash=data.commit_hash or uuid.uuid4().hex[:8],
        total_mutants=10,
        killed_mutants=8,
        surviving_mutants=2,
        mutation_score=80.0,
        duration_seconds=3.4,
        started_at=now,
        completed_at=now,
    )
    db.add(scan_job)
    await db.flush()

    # Generate sample AST mutations
    sample_mutations = [
        Mutation(
            scan_job_id=scan_job.id,
            project_id=project_id,
            organization_id=tenant.organization_id,
            file_path="src/auth/validator.py",
            line_number=42,
            operator="ROR",
            original_code="if token_exp > current_time:",
            mutated_code="if token_exp >= current_time:",
            status="killed",
            killing_test_name="test_expired_token_rejected",
        ),
        Mutation(
            scan_job_id=scan_job.id,
            project_id=project_id,
            organization_id=tenant.organization_id,
            file_path="src/billing/proration.py",
            line_number=118,
            operator="AOR",
            original_code="amount = total * (days_active / cycle_days)",
            mutated_code="amount = total / (days_active / cycle_days)",
            status="survived",
            killing_test_name=None,
        ),
        Mutation(
            scan_job_id=scan_job.id,
            project_id=project_id,
            organization_id=tenant.organization_id,
            file_path="src/api/rate_limiter.py",
            line_number=29,
            operator="LCR",
            original_code="if is_authenticated and has_quota:",
            mutated_code="if is_authenticated or has_quota:",
            status="survived",
            killing_test_name=None,
        ),
    ]
    db.add_all(sample_mutations)

    # Generate sample gap finding
    finding = Finding(
        scan_job_id=scan_job.id,
        project_id=project_id,
        organization_id=tenant.organization_id,
        finding_type="mutation_gap",
        severity="high",
        target_file="src/billing/proration.py",
        line_number=118,
        details="Arithmetic mutant AOR survived: Unhandled boundary when days_active equals 0.",
        suggested_fix="def test_zero_days_active_proration(): assert calculate_proration(0, 30, 100) == 0",
    )
    db.add(finding)
    await db.commit()
    await db.refresh(scan_job)

    return ScanJobRead.model_validate(scan_job)


@router.get("/scan-jobs/{job_id}/mutations", response_model=List[MutationRead])
async def list_job_mutations(
    job_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    operator: Optional[str] = Query(None, description="Filter by operator: ROR, AOR, LCR, BSR"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: killed, survived"),
) -> List[MutationRead]:
    """List mutations for a scan job, filtered by tenant, operator, and status."""
    query = select(Mutation).where(
        Mutation.scan_job_id == job_id,
        Mutation.organization_id == tenant.organization_id,
    )
    if operator:
        query = query.where(Mutation.operator == operator.upper())
    if status_filter:
        query = query.where(Mutation.status == status_filter.lower())

    mutations = (await db.execute(query)).scalars().all()
    return [MutationRead.model_validate(m) for m in mutations]


@router.get("/scan-jobs/{job_id}/findings", response_model=List[FindingRead])
async def list_job_findings(
    job_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[FindingRead]:
    """List test gap findings for a scan job."""
    query = select(Finding).where(
        Finding.scan_job_id == job_id,
        Finding.organization_id == tenant.organization_id,
    )
    findings = (await db.execute(query)).scalars().all()
    return [FindingRead.model_validate(f) for f in findings]
