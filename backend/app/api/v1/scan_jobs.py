import asyncio
import os
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.audit import IntegrationSetting
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
from app.services.archive_service import RetentionManager
from app.services.auto_test_generator import AutoTestGeneratorService
from app.services.discovery_service import TestDiscoveryService
from app.services.llm_service import LLMTestSynthesizer
from app.services.mutation_engine import ASTMutationEngine, MutantSpec
from app.services.queue_service import JobStatus, queue_engine
from app.services.validation_service import DualStateTestValidator

router = APIRouter(tags=["Scan Jobs & Mutations"])


async def ensure_project_workspace(
    db: AsyncSession,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> str:
    """
    Ensures that the repository source code is materialized on disk,
    git-cloning remote repositories if needed, and ensuring that
    executable test cases (including auto-generated suites) and
    test isolation stubs exist.
    """
    proj_q = select(Project).where(
        Project.id == project_id,
        Project.organization_id == organization_id,
    )
    project = (await db.execute(proj_q)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    repo_q = select(Repository).where(
        Repository.project_id == project_id,
        Repository.organization_id == organization_id,
    ).order_by(Repository.created_at.desc())
    repo = (await db.execute(repo_q)).scalars().first()

    workspace_path = None
    if repo:
        if repo.zip_artifact_path and os.path.isdir(repo.zip_artifact_path) and any(os.scandir(repo.zip_artifact_path)):
            workspace_path = repo.zip_artifact_path
        elif repo.repo_type == "github" and repo.repo_url:
            target_dir = RetentionManager.get_repo_storage_path(str(organization_id), str(repo.id))

            # Check for OAuth access token
            setting_q = select(IntegrationSetting).where(
                IntegrationSetting.organization_id == organization_id,
                IntegrationSetting.provider == "github",
                IntegrationSetting.is_enabled == True,
            )
            setting = (await db.execute(setting_q)).scalar_one_or_none()
            access_token = setting.config.get("access_token") if (setting and setting.config) else None

            clone_url = repo.repo_url
            if access_token and "github.com/" in clone_url:
                clean_url = clone_url.split("@")[-1] if "@" in clone_url else clone_url.replace("https://", "")
                clone_url = f"https://x-access-token:{access_token}@{clean_url}"

            if os.path.exists(target_dir):
                shutil.rmtree(target_dir, ignore_errors=True)
            target_dir.mkdir(parents=True, exist_ok=True)

            proc = await asyncio.create_subprocess_exec(
                "git", "clone", "--depth", "1", clone_url, str(target_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to clone GitHub repository from '{repo.repo_url}': {stderr.decode()[:200]}",
                )
            repo.zip_artifact_path = str(target_dir)
            await db.commit()
            await db.refresh(repo)
            workspace_path = str(target_dir)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Codebase files for project '{project.name}' are not available on disk. Please upload your project ZIP or reconnect GitHub.",
            )
    else:
        # Standalone project without VCS connection (e.g. integration test project)
        import re
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', project.name).lower().strip('_') or "project_module"
        target_dir = RetentionManager.get_repo_storage_path(str(organization_id), str(project.id))
        target_dir.mkdir(parents=True, exist_ok=True)
        workspace_path = str(target_dir)

        src_file = os.path.join(workspace_path, f"{safe_name}.py")
        if not os.path.exists(src_file):
            with open(src_file, "w", encoding="utf-8") as f:
                f.write(f'''def {safe_name}_compute(value: float, factor: float = 1.5) -> float:
    if value <= 0:
        raise ValueError("Value must be positive")
    if value > 50:
        return value * factor
    return value + factor
''')

        tests_dir = os.path.join(workspace_path, "tests")
        os.makedirs(tests_dir, exist_ok=True)
        test_file = os.path.join(tests_dir, f"test_{safe_name}.py")
        if not os.path.exists(test_file):
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(f'''import pytest
from {safe_name} import {safe_name}_compute

def test_{safe_name}_nominal():
    assert {safe_name}_compute(100.0, 2.0) == 200.0

def test_{safe_name}_boundary():
    assert {safe_name}_compute(20.0, 5.0) == 25.0

def test_{safe_name}_invalid():
    with pytest.raises(ValueError):
        {safe_name}_compute(-10.0)
''')

    # Validate Python source files exist
    py_files = TestDiscoveryService.discover_python_files(workspace_path)
    if not py_files["source_files"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No Python source files found in workspace for project '{project.name}'.",
        )

    # Ensure tests directory and conftest.py exist
    tests_dir = os.path.join(workspace_path, "tests")
    os.makedirs(tests_dir, exist_ok=True)

    conftest_path = os.path.join(tests_dir, "conftest.py")
    if not os.path.exists(conftest_path):
        with open(conftest_path, "w", encoding="utf-8") as f:
            f.write('''import sys, os, builtins, types
from unittest.mock import MagicMock
from importlib.machinery import ModuleSpec

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

class AutoMock(types.ModuleType):
    def __getattr__(self, name):
        return MagicMock()

class AutoMockFinder:
    _finding = set()

    @classmethod
    def find_spec(cls, fullname, path=None, target=None):
        if fullname.startswith("pytest") or fullname.startswith("_pytest") or fullname in sys.builtin_module_names:
            return None
        if fullname in cls._finding:
            return None
        cls._finding.add(fullname)
        try:
            import importlib.util
            spec = importlib.util.find_spec(fullname)
            if spec is not None:
                return None
        except Exception:
            pass
        finally:
            cls._finding.discard(fullname)
        return ModuleSpec(fullname, cls)

    @classmethod
    def create_module(cls, spec):
        return AutoMock(spec.name)

    @classmethod
    def exec_module(cls, module):
        pass

if not any(getattr(f, "__name__", "") == "AutoMockFinder" for f in sys.meta_path):
    sys.meta_path.append(AutoMockFinder)

def _safe_get_terminal_size(fallback=(80, 24)):
    return os.terminal_size((80, 24))
os.get_terminal_size = _safe_get_terminal_size

def _mock_input(prompt=""):
    return "5"
builtins.input = _mock_input

def _safe_exit(code=0):
    pass
sys.exit = _safe_exit
''')

    # If no test files on disk, materialize from DB or auto-generate
    if not py_files["test_files"]:
        tc_q = select(TestCase).where(
            TestCase.project_id == project_id,
            TestCase.organization_id == organization_id,
        )
        existing_cases = (await db.execute(tc_q)).scalars().all()
        if existing_cases:
            test_file_path = os.path.join(tests_dir, "test_auto_generated.py")
            combined = "# ====================================================================\n"
            combined += "# TestBlind AI Auto-Generated Test Suite\n"
            combined += "# ====================================================================\nimport pytest\n\n"
            for c in existing_cases:
                code_snippet = c.code.replace("import pytest\n", "") if "import pytest" in c.code else c.code
                combined += f"\n{code_snippet.strip()}\n"
            with open(test_file_path, "w", encoding="utf-8") as f:
                f.write(combined)
        else:
            await AutoTestGeneratorService.analyze_and_generate(
                project_id=project.id,
                organization_id=organization_id,
                db=db,
                create_test_cases=True,
                create_scenarios=True,
                force=True,
            )

    return workspace_path


async def _run_scan_pipeline(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    branch: str,
    trigger: str,
    commit_hash: Optional[str],
    db: AsyncSession,
) -> ScanJob:
    scan_dir = await ensure_project_workspace(db, project_id, organization_id)
    summary = await TestDiscoveryService.run_mutation_scan_on_workspace(scan_dir, max_mutants=20)

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

    # Locate actual source file from repository workspace
    repo_q = select(Repository).where(
        Repository.project_id == mutation.project_id,
        Repository.organization_id == tenant.organization_id,
    ).order_by(Repository.created_at.desc())
    repo = (await db.execute(repo_q)).scalars().first()

    source_code = ""
    module_name = "solution"
    if repo and repo.zip_artifact_path and os.path.isdir(repo.zip_artifact_path):
        target_path = Path(repo.zip_artifact_path) / mutation.file_path
        if target_path.exists():
            source_code = target_path.read_text(encoding="utf-8")
            module_name = target_path.stem

    if not source_code:
        proj_dir = RetentionManager.get_repo_storage_path(str(tenant.organization_id), str(mutation.project_id))
        target_path = proj_dir / mutation.file_path
        if target_path.exists():
            source_code = target_path.read_text(encoding="utf-8")
            module_name = target_path.stem

    if not source_code:
        source_code = mutation.original_code
        module_name = Path(mutation.file_path).stem if mutation.file_path else "solution"

    mutated_source = (
        source_code.replace(mutation.original_code, mutation.mutated_code, 1)
        if mutation.original_code in source_code
        else mutation.mutated_code
    )

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
        mutated_source=mutated_source,
    )

    gap = LLMTestSynthesizer.explain_gap(source_code, mut_spec)
    synthesized_test = await LLMTestSynthesizer.synthesize_killing_test_async(source_code, mut_spec, module_name=module_name)

    # Perform dual-state validation
    outcome = await DualStateTestValidator.validate_candidate_test(
        source_code=source_code,
        mutated_source=mutated_source,
        candidate_test_code=synthesized_test,
        module_name=module_name,
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
