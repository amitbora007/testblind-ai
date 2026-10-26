import uuid
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.test import TestCase
from app.models.user import RoleEnum
from app.schemas.test import TestCaseCreate, TestCaseRead

router = APIRouter(tags=["Test Cases"])


@router.get("/projects/{project_id}/test-cases", response_model=List[TestCaseRead])
async def list_project_test_cases(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    framework: Optional[str] = Query(None, description="Filter by framework: pytest, vitest, go"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: verified, ai_suggested, failed"),
) -> List[TestCaseRead]:
    """List test cases for a project, scoped strictly to the current tenant."""
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
    if framework:
        query = query.where(TestCase.framework == framework.lower())
    if status_filter:
        query = query.where(TestCase.status == status_filter.lower())

    cases = (await db.execute(query.order_by(TestCase.created_at.desc()))).scalars().all()
    return [TestCaseRead.model_validate(c) for c in cases]


@router.post("/projects/{project_id}/test-cases", response_model=TestCaseRead, status_code=status.HTTP_201_CREATED)
async def create_test_case(
    project_id: uuid.UUID,
    data: TestCaseCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestCaseRead:
    """Create a new test case for a project. Requires Engineer role."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    test_case = TestCase(
        project_id=project_id,
        organization_id=tenant.organization_id,
        name=data.name.strip(),
        file_path=data.file_path.strip(),
        function_name=data.function_name.strip(),
        framework=data.framework.lower(),
        code=data.code,
        status="verified",
        mutation_kill_count=3,
        is_flaky=False,
    )
    db.add(test_case)
    await db.commit()
    await db.refresh(test_case)

    return TestCaseRead.model_validate(test_case)
