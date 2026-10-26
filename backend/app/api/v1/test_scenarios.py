import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.test import TestScenario
from app.models.user import RoleEnum
from app.schemas.test import TestScenarioCreate, TestScenarioRead

router = APIRouter(tags=["Test Scenarios"])


@router.get("/projects/{project_id}/test-scenarios", response_model=List[TestScenarioRead])
async def list_project_test_scenarios(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[TestScenarioRead]:
    """List test scenarios for a project, scoped to the current tenant."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = select(TestScenario).where(
        TestScenario.project_id == project_id,
        TestScenario.organization_id == tenant.organization_id,
    ).order_by(TestScenario.created_at.desc())

    scenarios = (await db.execute(query)).scalars().all()
    return [TestScenarioRead.model_validate(s) for s in scenarios]


@router.post("/projects/{project_id}/test-scenarios", response_model=TestScenarioRead, status_code=status.HTTP_201_CREATED)
async def create_test_scenario(
    project_id: uuid.UUID,
    data: TestScenarioCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestScenarioRead:
    """Create a new test scenario suite. Requires Engineer role."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    scenario = TestScenario(
        project_id=project_id,
        organization_id=tenant.organization_id,
        name=data.name.strip(),
        requirement_code=data.requirement_code.strip(),
        description=data.description,
        steps=data.steps,
        status="passed",
        timeout_seconds=data.timeout_seconds,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    return TestScenarioRead.model_validate(scenario)
