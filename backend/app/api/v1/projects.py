import re
import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.project import Project, Repository
from app.models.user import RoleEnum
from app.schemas.project import ProjectCreate, ProjectRead, RepoConnect, RepoRead
from app.schemas.test import AutoGenerateTestsRequest, AutoGenerateTestsResponse
from app.services.auto_test_generator import AutoTestGeneratorService

router = APIRouter(prefix="/projects", tags=["Projects"])


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug or "project"


@router.get("", response_model=List[ProjectRead])
async def list_projects(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[ProjectRead]:
    """List all projects belonging to the active organization tenant."""
    query = (
        select(Project)
        .where(Project.organization_id == tenant.organization_id)
        .order_by(Project.created_at.desc())
    )
    projects = (await db.execute(query)).scalars().all()
    return [ProjectRead.model_validate(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectRead:
    """Create a new project scoped to the current tenant organization."""
    base_slug = slugify(data.slug or data.name)
    project_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    project = Project(
        organization_id=tenant.organization_id,
        name=data.name.strip(),
        slug=project_slug,
        description=data.description,
        framework=data.framework,
        default_branch=data.default_branch,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectRead:
    """Retrieve project details. Strictly verifies organization ownership."""
    query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(query)).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return ProjectRead.model_validate(project)


@router.post("/{project_id}/repository", response_model=RepoRead, status_code=status.HTTP_201_CREATED)
async def connect_repository(
    project_id: uuid.UUID,
    data: RepoConnect,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepoRead:
    """Connect a version control repository or ZIP archive to a project."""
    # Verify project exists and belongs to current tenant
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    repo = Repository(
        project_id=project.id,
        organization_id=tenant.organization_id,
        repo_type=data.repo_type,
        repo_url=data.repo_url,
        default_branch=data.default_branch,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    return RepoRead.model_validate(repo)


@router.post("/{project_id}/auto-generate-tests", response_model=AutoGenerateTestsResponse, status_code=status.HTTP_201_CREATED)
async def auto_generate_project_tests(
    project_id: uuid.UUID,
    data: AutoGenerateTestsRequest,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AutoGenerateTestsResponse:
    """
    Automatically analyzes repository source code and creates initial unit test cases
    and multi-step test scenarios if no tests are present for the project.
    """
    try:
        response = await AutoTestGeneratorService.analyze_and_generate(
            project_id=project_id,
            organization_id=tenant.organization_id,
            db=db,
            create_test_cases=data.create_test_cases,
            create_scenarios=data.create_scenarios,
            force=data.force,
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto test generation error: {str(e)}",
        )


@router.get("/{project_id}/branches", response_model=List[str])
async def list_project_branches(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[str]:
    """
    Retrieve all verified branches for the project's repository.
    Ensures branch selectors only show the available branches of the selected repository.
    """
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    branches: set[str] = set()
    if project.default_branch:
        branches.add(project.default_branch)

    # Check connected repositories
    repo_query = select(Repository).where(
        Repository.project_id == project.id,
        Repository.organization_id == tenant.organization_id,
    )
    repos = (await db.execute(repo_query)).scalars().all()
    for r in repos:
        if r.default_branch:
            branches.add(r.default_branch)

        # If connected to GitHub, fetch remote branches for this specific repository
        if r.repo_url and "github.com" in r.repo_url:
            clean_name = r.repo_url.rstrip("/").split("github.com/")[-1]
            if "/" in clean_name:
                owner, repo_name = clean_name.split("/", 1)
                repo_name = repo_name.replace(".git", "")
                try:
                    import httpx
                    from app.models.audit import IntegrationSetting
                    int_query = select(IntegrationSetting).where(
                        IntegrationSetting.organization_id == tenant.organization_id,
                        IntegrationSetting.provider == "github",
                        IntegrationSetting.is_enabled == True,
                    )
                    setting = (await db.execute(int_query)).scalar_one_or_none()
                    token = setting.config.get("access_token") if (setting and setting.config) else None
                    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "TestBlind-AI"}
                    if token:
                        headers["Authorization"] = f"Bearer {token}"
                    async with httpx.AsyncClient(timeout=4.0) as client:
                        resp = await client.get(
                            f"https://api.github.com/repos/{owner}/{repo_name}/branches?per_page=100",
                            headers=headers,
                        )
                        if resp.status_code == 200:
                            for b in resp.json():
                                if "name" in b:
                                    branches.add(b["name"])
                except Exception:
                    pass

    # Include distinct branches from actual execution runs, scan jobs, and test cases for this project
    from app.models.scan import ScanJob
    from app.models.run import ExecutionRun
    from app.models.test import TestCase

    sj_branches = (await db.execute(
        select(ScanJob.branch).where(ScanJob.project_id == project.id).distinct()
    )).scalars().all()
    for b in sj_branches:
        if b:
            branches.add(b)

    er_branches = (await db.execute(
        select(ExecutionRun.branch).where(ExecutionRun.project_id == project.id).distinct()
    )).scalars().all()
    for b in er_branches:
        if b:
            branches.add(b)

    tc_branches = (await db.execute(
        select(TestCase.branch).where(TestCase.project_id == project.id).distinct()
    )).scalars().all()
    for b in tc_branches:
        if b:
            branches.add(b)

    # Sort and guarantee default branch is first
    branch_list = sorted(list(branches))
    if project.default_branch in branch_list:
        branch_list.remove(project.default_branch)
        branch_list.insert(0, project.default_branch)

    return branch_list or [project.default_branch or "main"]

