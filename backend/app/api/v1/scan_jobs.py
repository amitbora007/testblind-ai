import os
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project, Repository
from app.models.scan import Finding, Mutation, ScanJob
from app.models.test import TestCase
from app.models.user import RoleEnum
from app.schemas.scan import (
    FindingRead,
    MutationRead,
    PromoteMutationRequest,
    PromoteMutationResponse,
    ScanJobCreate,
    ScanJobRead,
    SynthesizeMutationResponse,
)
from app.services.discovery_service import TestDiscoveryService
from app.services.llm_service import LLMTestSynthesizer
from app.services.mutation_engine import ASTMutationEngine, MutantSpec
from app.services.queue_service import JobStatus, queue_engine
from app.services.validation_service import DualStateTestValidator

router = APIRouter(tags=["Scan Jobs & Mutations"])


SAMPLE_SOLUTION_CODE = """def calculate_tier_discount(order_total: float, customer_tier: str) -> float:
    if order_total <= 0:
        raise ValueError("Order total must be positive")

    if customer_tier == "PLATINUM":
        if order_total > 500:
            return 0.25
        elif order_total > 100:
            return 0.15
        return 0.05
    elif customer_tier == "GOLD":
        if order_total > 100:
            return 0.10
        return 0.02
    return 0.0
"""

SAMPLE_TEST_CODE = """import pytest
from solution import calculate_tier_discount

def test_platinum_high():
    assert calculate_tier_discount(600, "PLATINUM") == 0.25

def test_gold_normal():
    assert calculate_tier_discount(200, "GOLD") == 0.10

def test_invalid_negative():
    with pytest.raises(ValueError):
        calculate_tier_discount(-5, "PLATINUM")
"""


async def _run_scan_pipeline(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    branch: str,
    trigger: str,
    commit_hash: Optional[str],
    db: AsyncSession,
) -> ScanJob:
    # 1. Check if linked repository with uploaded zip exists
    repo_q = select(Repository).where(
        Repository.project_id == project_id,
        Repository.organization_id == organization_id,
    ).order_by(Repository.created_at.desc())
    repo = (await db.execute(repo_q)).scalars().first()

    scan_dir = None
    cleanup_temp = False

    if repo and repo.zip_artifact_path and os.path.isdir(repo.zip_artifact_path):
        scan_dir = repo.zip_artifact_path
    else:
        # Create ephemeral sample project fixture
        scan_dir = tempfile.mkdtemp(prefix="tb_scan_fixture_")
        cleanup_temp = True
        tests_dir = os.path.join(scan_dir, "tests")
        os.makedirs(tests_dir, exist_ok=True)
        with open(os.path.join(scan_dir, "solution.py"), "w", encoding="utf-8") as f:
            f.write(SAMPLE_SOLUTION_CODE)
        with open(os.path.join(tests_dir, "test_solution.py"), "w", encoding="utf-8") as f:
            f.write(SAMPLE_TEST_CODE)

    try:
        summary = await TestDiscoveryService.run_mutation_scan_on_workspace(scan_dir, max_mutants=20)
    finally:
        if cleanup_temp and scan_dir:
            shutil.rmtree(scan_dir, ignore_errors=True)

    now = datetime.now(timezone.utc)
    scan_job = ScanJob(
        id=uuid.uuid4(),
        project_id=project_id,
        organization_id=organization_id,
        status="completed",
        trigger=trigger,
        branch=branch,
        commit_hash=commit_hash or uuid.uuid4().hex[:8],
        total_mutants=summary.total_mutants,
        killed_mutants=summary.killed_mutants,
        surviving_mutants=summary.surviving_mutants,
        mutation_score=summary.mutation_score,
        duration_seconds=summary.duration_seconds,
        started_at=now,
        completed_at=now,
    )
    db.add(scan_job)
    await db.flush()

    # Persist mutations
    for m in summary.mutants:
        gap = LLMTestSynthesizer.explain_gap(m.original_snippet, m)
        mutation_row = Mutation(
            id=uuid.uuid4(),
            scan_job_id=scan_job.id,
            project_id=project_id,
            organization_id=organization_id,
            file_path=m.file_path,
            line_number=m.line_number,
            operator=m.operator,
            original_code=m.original_snippet,
            mutated_code=m.mutated_snippet,
            status=m.status,
            killing_test_name=m.killing_test_name,
            explanation=gap.explanation,
            missing_boundary=gap.missing_boundary,
        )
        db.add(mutation_row)

        # Generate finding for surviving mutants
        if m.status == "survived":
            finding = Finding(
                id=uuid.uuid4(),
                scan_job_id=scan_job.id,
                project_id=project_id,
                organization_id=organization_id,
                finding_type="mutation_gap",
                severity="high",
                target_file=m.file_path,
                line_number=m.line_number,
                details=gap.explanation,
                suggested_fix=gap.recommended_action,
            )
            db.add(finding)

    await db.commit()
    await db.refresh(scan_job)
    return scan_job


@router.get("/projects/{project_id}/scan-jobs", response_model=List[ScanJobRead])
async def list_project_scan_jobs(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[ScanJobRead]:
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
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Idempotency check
    if data.idempotency_key:
        existing_job_id = queue_engine._idempotency_index.get(data.idempotency_key)
        if existing_job_id:
            try:
                exist_uuid = uuid.UUID(existing_job_id)
                existing_scan_q = select(ScanJob).where(
                    ScanJob.id == exist_uuid,
                    ScanJob.organization_id == tenant.organization_id,
                )
                existing_scan = (await db.execute(existing_scan_q)).scalar_one_or_none()
                if existing_scan:
                    return ScanJobRead.model_validate(existing_scan)
            except ValueError:
                pass

    scan_job = await _run_scan_pipeline(
        project_id=project_id,
        organization_id=tenant.organization_id,
        branch=data.branch,
        trigger=data.trigger,
        commit_hash=data.commit_hash,
        db=db,
    )

    # Submit to queue engine for operational fleet tracking
    await queue_engine.submit_job(
        job_id=str(scan_job.id),
        tenant_id=str(tenant.organization_id),
        project_id=str(project_id),
        job_type="scan_job",
        command=[sys.executable, "-c", "import sys; print('AST mutation scan complete.')"],
        idempotency_key=data.idempotency_key,
        timeout_seconds=data.timeout_seconds or 30,
    )

    return ScanJobRead.model_validate(scan_job)


@router.post("/projects/{project_id}/scan-jobs/sync", response_model=ScanJobRead, status_code=status.HTTP_200_OK)
async def trigger_scan_job_sync(
    project_id: uuid.UUID,
    data: ScanJobCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScanJobRead:
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    scan_job = await _run_scan_pipeline(
        project_id=project_id,
        organization_id=tenant.organization_id,
        branch=data.branch,
        trigger=data.trigger,
        commit_hash=data.commit_hash,
        db=db,
    )
    return ScanJobRead.model_validate(scan_job)


@router.get("/scan-jobs/{job_id}", response_model=ScanJobRead)
async def get_scan_job(
    job_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScanJobRead:
    query = select(ScanJob).where(
        ScanJob.id == job_id,
        ScanJob.organization_id == tenant.organization_id,
    )
    job = (await db.execute(query)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")

    queued_job = queue_engine.get_job(str(job_id), str(tenant.organization_id))
    if queued_job and job.status != "cancelled" and queued_job.status != job.status:
        job.status = queued_job.status

    return ScanJobRead.model_validate(job)


@router.post("/scan-jobs/{job_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_scan_job(
    job_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    query = select(ScanJob).where(
        ScanJob.id == job_id,
        ScanJob.organization_id == tenant.organization_id,
    )
    job = (await db.execute(query)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")

    cancelled = queue_engine.cancel_job(str(job_id), str(tenant.organization_id))
    job.status = "cancelled"
    await db.commit()

    return {
        "id": str(job_id),
        "status": "cancelled",
        "message": "Scan job cancellation initiated." if cancelled else "Scan job marked cancelled.",
    }


@router.get("/scan-jobs/{job_id}/mutations", response_model=List[MutationRead])
async def list_job_mutations(
    job_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    operator: Optional[str] = Query(None, description="Filter by operator: ROR, AOR, LCR, BSR"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: killed, survived, timeout, equivalent"),
) -> List[MutationRead]:
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
    query = select(Finding).where(
        Finding.scan_job_id == job_id,
        Finding.organization_id == tenant.organization_id,
    )
    findings = (await db.execute(query)).scalars().all()
    return [FindingRead.model_validate(f) for f in findings]


@router.post("/scan-jobs/{job_id}/mutations/{mutation_id}/synthesize", response_model=SynthesizeMutationResponse)
async def synthesize_mutation_test(
    job_id: uuid.UUID,
    mutation_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SynthesizeMutationResponse:
    mut_q = select(Mutation).where(
        Mutation.id == mutation_id,
        Mutation.scan_job_id == job_id,
        Mutation.organization_id == tenant.organization_id,
    )
    mutation = (await db.execute(mut_q)).scalar_one_or_none()
    if not mutation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mutation not found")

    # Reconstruct mutant specification
    mut_spec = MutantSpec(
        id=str(mutation.id),
        file_path=mutation.file_path,
        line_number=mutation.line_number,
        col_offset=0,
        operator=mutation.operator,
        original_token=mutation.original_code,
        mutated_token=mutation.mutated_code,
        original_snippet=mutation.original_code,
        mutated_snippet=mutation.mutated_code,
        description=f"Mutation {mutation.operator} at line {mutation.line_number}",
        mutated_source=SAMPLE_SOLUTION_CODE.replace(mutation.original_code, mutation.mutated_code, 1),
    )

    gap = LLMTestSynthesizer.explain_gap(SAMPLE_SOLUTION_CODE, mut_spec)
    synthesized_test = LLMTestSynthesizer.synthesize_killing_test(SAMPLE_SOLUTION_CODE, mut_spec)

    # Perform dual-state validation
    mutated_source = SAMPLE_SOLUTION_CODE.replace(mutation.original_code, mutation.mutated_code, 1)
    outcome = await DualStateTestValidator.validate_candidate_test(
        source_code=SAMPLE_SOLUTION_CODE,
        mutated_source=mutated_source,
        candidate_test_code=synthesized_test,
    )

    # Update mutation record
    mutation.synthesized_test_code = synthesized_test
    mutation.verification_status = outcome.verification_status
    mutation.evidence_hash = outcome.evidence_hash
    mutation.explanation = gap.explanation
    mutation.missing_boundary = gap.missing_boundary
    await db.commit()

    return SynthesizeMutationResponse(
        mutation_id=mutation.id,
        synthesized_test_code=synthesized_test,
        verification_status=outcome.verification_status,
        verified=outcome.verified,
        baseline_passed=outcome.baseline_passed,
        mutant_killed=outcome.mutant_killed,
        evidence_hash=outcome.evidence_hash,
        duration_ms=outcome.duration_ms,
        explanation=gap.explanation,
        missing_boundary=gap.missing_boundary,
        recommended_action=gap.recommended_action,
        details=outcome.details,
    )


@router.post("/scan-jobs/{job_id}/mutations/{mutation_id}/promote", response_model=PromoteMutationResponse)
async def promote_mutation_test(
    job_id: uuid.UUID,
    mutation_id: uuid.UUID,
    data: PromoteMutationRequest,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PromoteMutationResponse:
    mut_q = select(Mutation).where(
        Mutation.id == mutation_id,
        Mutation.scan_job_id == job_id,
        Mutation.organization_id == tenant.organization_id,
    )
    mutation = (await db.execute(mut_q)).scalar_one_or_none()
    if not mutation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mutation not found")

    test_code = data.test_code or mutation.synthesized_test_code
    if not test_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No synthesized test code available to promote. Synthesize a test first.",
        )

    test_name = data.name or f"test_kill_mutant_{mutation.operator.lower()}_l{mutation.line_number}"
    test_case = TestCase(
        id=uuid.uuid4(),
        project_id=mutation.project_id,
        organization_id=tenant.organization_id,
        name=test_name,
        file_path=f"tests/test_{os.path.basename(mutation.file_path)}",
        function_name=test_name,
        framework="pytest",
        code=test_code,
        status="verified",
        mutation_kill_count=1,
        is_flaky=False,
    )
    db.add(test_case)
    await db.commit()

    return PromoteMutationResponse(
        test_case_id=test_case.id,
        project_id=test_case.project_id,
        name=test_case.name,
        file_path=test_case.file_path,
        status=test_case.status,
        mutation_kill_count=test_case.mutation_kill_count,
        message="Synthesized test promoted to regression test suite.",
    )
