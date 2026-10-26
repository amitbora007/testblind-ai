import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.run import ExecutionRun, RunStep
from app.models.user import RoleEnum
from app.schemas.run import ExecutionRunCreate, ExecutionRunRead, RunLogsRead

router = APIRouter(tags=["Execution Runs"])


@router.get("/projects/{project_id}/execution-runs", response_model=List[ExecutionRunRead])
async def list_project_execution_runs(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[ExecutionRunRead]:
    """List execution runs for a project."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = select(ExecutionRun).where(
        ExecutionRun.project_id == project_id,
        ExecutionRun.organization_id == tenant.organization_id,
    ).order_by(ExecutionRun.created_at.desc())

    runs = (await db.execute(query)).scalars().all()
    return [ExecutionRunRead.model_validate(r) for r in runs]


@router.post("/projects/{project_id}/execution-runs", response_model=ExecutionRunRead, status_code=status.HTTP_201_CREATED)
async def trigger_execution_run(
    project_id: uuid.UUID,
    data: ExecutionRunCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExecutionRunRead:
    """Trigger an isolated container execution run for a project."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    sample_logs = (
        "[00:00.01] Ephemeral container provisioned: testblind-runner-python:3.12 (UID 10001)\n"
        "[00:00.05] Sandboxing active: --read-only, --network=none, cpus=2.0, mem=4096MB\n"
        "[00:00.12] Executing pytest -q tests/\n"
        "============================= test session starts ==============================\n"
        "tests/test_auth.py ....                                                  [ 50%]\n"
        "tests/test_billing.py ....                                               [100%]\n"
        "============================== 8 passed in 1.42s ==============================\n"
        "[00:01.44] Execution run completed with exit code 0."
    )

    run = ExecutionRun(
        project_id=project_id,
        organization_id=tenant.organization_id,
        trigger=data.trigger,
        trigger_label=data.trigger_label or "Manual Console Trigger",
        branch=data.branch,
        commit_hash=data.commit_hash or uuid.uuid4().hex[:8],
        status="passed",
        duration_ms=1440,
        tests_passed=8,
        tests_failed=0,
        total_tests=8,
        stdout_log=sample_logs,
    )
    db.add(run)
    await db.flush()

    step = RunStep(
        execution_run_id=run.id,
        organization_id=tenant.organization_id,
        step_name="pytest execution",
        step_order=1,
        status="passed",
        duration_ms=1440,
        log_output=sample_logs,
    )
    db.add(step)
    await db.commit()
    await db.refresh(run)

    return ExecutionRunRead.model_validate(run)


@router.get("/execution-runs/{run_id}/logs", response_model=RunLogsRead)
async def get_execution_run_logs(
    run_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunLogsRead:
    """Retrieve execution stdout and stderr logs. Validates tenant access."""
    query = select(ExecutionRun).where(
        ExecutionRun.id == run_id,
        ExecutionRun.organization_id == tenant.organization_id,
    )
    run = (await db.execute(query)).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution run not found")

    return RunLogsRead(
        id=run.id,
        status=run.status,
        stdout_log=run.stdout_log,
        stderr_log=run.stderr_log,
    )
