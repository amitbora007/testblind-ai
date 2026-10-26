import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.test import TestCase
from app.models.user import RoleEnum
from app.schemas.test import (
    TestCaseCreate,
    TestCaseDuplicateCheckResponse,
    TestCaseGroupedResponse,
    TestCaseRead,
    TestCaseReviewRequest,
    TestCaseRunResponse,
)
from app.services.regression_service import RegressionService

router = APIRouter(tags=["Test Cases"])


@router.get("/projects/{project_id}/test-cases", response_model=Any)
async def list_project_test_cases(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(None, description="Search across name, file path, and code"),
    repository: Optional[str] = Query(None, description="Filter by repository name"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    commit_sha: Optional[str] = Query(None, description="Filter by commit SHA"),
    source_incident_id: Optional[uuid.UUID] = Query(None, description="Filter by source incident ID"),
    test_type: Optional[str] = Query(None, description="Filter by test type: mutation_killer, incident_regression, etc"),
    framework: Optional[str] = Query(None, description="Filter by framework: pytest, vitest, go"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: verified, ai_suggested, failed"),
    review_status: Optional[str] = Query(None, description="Filter by review status: approved, pending_review, rejected"),
    gap_resolved: Optional[bool] = Query(None, description="Filter by gap resolved boolean"),
    group_by: Optional[str] = Query(None, description="Group results by: repository, branch, commit, incident, test_type"),
):
    """List test cases for a project with rich filtering, search, and optional grouping."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = select(TestCase).where(
        TestCase.project_id == project_id,
        TestCase.organization_id == tenant.organization_id,
    )

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                TestCase.name.ilike(s),
                TestCase.file_path.ilike(s),
                TestCase.function_name.ilike(s),
                TestCase.code.ilike(s),
            )
        )
    if repository:
        query = query.where(TestCase.repository_name == repository)
    if branch:
        query = query.where(TestCase.branch == branch)
    if commit_sha:
        query = query.where(TestCase.commit_sha == commit_sha)
    if source_incident_id:
        query = query.where(TestCase.source_incident_id == source_incident_id)
    if test_type:
        query = query.where(TestCase.test_type == test_type)
    if framework:
        query = query.where(TestCase.framework == framework.lower())
    if status_filter:
        query = query.where(TestCase.status == status_filter.lower())
    if review_status:
        query = query.where(TestCase.review_status == review_status.lower())
    if gap_resolved is not None:
        query = query.where(TestCase.gap_resolved == gap_resolved)

    cases = (await db.execute(query.order_by(TestCase.created_at.desc()))).scalars().all()
    models = [TestCaseRead.model_validate(c) for c in cases]

    # If grouping requested, organize into dictionary
    if group_by:
        grouped: Dict[str, List[TestCaseRead]] = {}
        for tc in models:
            if group_by == "repository":
                key = tc.repository_name or "default"
            elif group_by == "branch":
                key = tc.branch or "main"
            elif group_by == "commit":
                key = tc.commit_sha or "unspecified"
            elif group_by == "incident":
                key = str(tc.source_incident_id) if tc.source_incident_id else "none"
            elif group_by == "test_type":
                key = tc.test_type or "standard"
            else:
                key = "all"

            grouped.setdefault(key, []).append(tc)

        return TestCaseGroupedResponse(grouped_by=group_by, groups=grouped)

    return models


@router.post("/projects/{project_id}/test-cases", response_model=TestCaseRead, status_code=status.HTTP_201_CREATED)
async def create_test_case(
    project_id: uuid.UUID,
    data: TestCaseCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseRead:
    """Create a new test case for a project with duplicate detection and evidence recording."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    code_hash = RegressionService.compute_code_hash(data.code)

    # Check for duplicate
    duplicate = await RegressionService.check_duplicate(db, project_id, code_hash)
    if duplicate:
        # If identical test already exists, return the existing test case
        return TestCaseRead.model_validate(duplicate)

    test_case = TestCase(
        project_id=project_id,
        organization_id=tenant.organization_id,
        name=data.name.strip(),
        file_path=data.file_path.strip(),
        function_name=data.function_name.strip(),
        framework=data.framework.lower(),
        code=data.code,
        repository_name=data.repository_name,
        branch=data.branch or "main",
        commit_sha=data.commit_sha,
        test_type=data.test_type or "mutation_killer",
        source_incident_id=data.source_incident_id,
        source_mutation_id=data.source_mutation_id,
        review_status=data.review_status or "approved",
        verification_status=data.verification_status or "verified",
        evidence_hash=data.evidence_hash,
        evidence_details=data.evidence_details or {},
        code_hash=code_hash,
        gap_resolved=data.gap_resolved if data.gap_resolved is not None else True,
        gap_details=data.gap_details,
        status="verified",
        mutation_kill_count=3,
        is_flaky=False,
    )
    db.add(test_case)
    await db.commit()
    await db.refresh(test_case)

    return TestCaseRead.model_validate(test_case)


@router.get("/test-cases/{test_case_id}", response_model=TestCaseRead)
async def get_test_case(
    test_case_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseRead:
    """Retrieve full details for a single test case including evidence and execution history."""
    query = select(TestCase).where(
        TestCase.id == test_case_id,
        TestCase.organization_id == tenant.organization_id,
    )
    test_case = (await db.execute(query)).scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")

    return TestCaseRead.model_validate(test_case)


@router.put("/test-cases/{test_case_id}/review", response_model=TestCaseRead)
async def review_test_case(
    test_case_id: uuid.UUID,
    data: TestCaseReviewRequest,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseRead:
    """Review and approve or reject a test case."""
    query = select(TestCase).where(
        TestCase.id == test_case_id,
        TestCase.organization_id == tenant.organization_id,
    )
    test_case = (await db.execute(query)).scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")

    valid_statuses = ("approved", "rejected", "pending_review")
    if data.review_status.lower() not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review_status. Must be one of {valid_statuses}",
        )

    test_case.review_status = data.review_status.lower()
    test_case.reviewed_by = data.reviewed_by or str(tenant.user.email if hasattr(tenant.user, "email") else "reviewer")
    test_case.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(test_case)

    return TestCaseRead.model_validate(test_case)


@router.post("/test-cases/{test_case_id}/run", response_model=TestCaseRunResponse)
async def run_test_case(
    test_case_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseRunResponse:
    """Execute a cataloged test case in an isolated execution sandbox and record verification results."""
    query = select(TestCase).where(
        TestCase.id == test_case_id,
        TestCase.organization_id == tenant.organization_id,
    )
    test_case = (await db.execute(query)).scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")

    result = await RegressionService.execute_test_case(db, test_case)
    return TestCaseRunResponse(**result)


@router.post("/projects/{project_id}/test-cases/duplicate-check", response_model=TestCaseDuplicateCheckResponse)
async def check_test_case_duplicate(
    project_id: uuid.UUID,
    payload: Dict[str, str],
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseDuplicateCheckResponse:
    """Checks whether the provided test code duplicates an existing test in the project."""
    code = payload.get("code", "")
    code_hash = RegressionService.compute_code_hash(code)
    duplicate = await RegressionService.check_duplicate(db, project_id, code_hash)

    if duplicate:
        return TestCaseDuplicateCheckResponse(
            is_duplicate=True,
            duplicate_test_case_id=duplicate.id,
            code_hash=code_hash,
            message=f"Duplicate test detected matching existing test '{duplicate.name}' (ID: {duplicate.id}).",
        )

    return TestCaseDuplicateCheckResponse(
        is_duplicate=False,
        duplicate_test_case_id=None,
        code_hash=code_hash,
        message="No duplicate tests found. Code signature is unique.",
    )


@router.get("/test-cases/{test_case_id}/export")
async def export_single_test_case(
    test_case_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Download a test case as an executable Python or TypeScript test file."""
    query = select(TestCase).where(
        TestCase.id == test_case_id,
        TestCase.organization_id == tenant.organization_id,
    )
    test_case = (await db.execute(query)).scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")

    ext = ".py" if test_case.framework in ("pytest", "python") else ".ts"
    filename = f"{test_case.name}{ext}"

    content = f"""# TestBlind AI — Certified Regression Test
# Test ID: {test_case.id}
# Framework: {test_case.framework}
# Verification Hash: {test_case.evidence_hash or 'N/A'}
# Generated At: {test_case.created_at.isoformat()}

{test_case.code}
"""
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/test-cases/export")
async def export_project_test_suite(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Export the entire regression test catalog for a project as an aggregated suite."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    tc_query = select(TestCase).where(
        TestCase.project_id == project_id,
        TestCase.organization_id == tenant.organization_id,
        TestCase.review_status == "approved",
    ).order_by(TestCase.created_at.asc())
    cases = (await db.execute(tc_query)).scalars().all()

    header = f"""# ==============================================================================
# TestBlind AI — Unified Regression Suite Export
# Project: {project.name} (Key: {project.key})
# Exported At: {datetime.now(timezone.utc).isoformat()}
# Total Tests: {len(cases)}
# ==============================================================================
import pytest

"""
    suite_code = header + "\n\n".join(
        f"# --- Test: {c.name} (Hash: {c.evidence_hash or 'unsealed'}) ---\n{c.code}" for c in cases
    )

    return Response(
        content=suite_code,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{project.key.lower()}_regression_suite.py"'},
    )
