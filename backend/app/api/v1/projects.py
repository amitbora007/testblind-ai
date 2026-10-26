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
