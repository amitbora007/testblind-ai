import re
import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext, get_current_user, get_tenant_context, require_role
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import Organization, RoleEnum, User, UserMembership
from app.schemas.organization import (
    MemberInvite,
    MemberRead,
    OrganizationCreate,
    OrganizationRead,
)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug or "org"


@router.get("", response_model=List[OrganizationRead])
async def list_user_organizations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[OrganizationRead]:
    """List all organizations the authenticated user is an active member of."""
    query = (
        select(Organization)
        .join(UserMembership)
        .where(UserMembership.user_id == current_user.id)
        .order_by(Organization.created_at.desc())
    )
    orgs = (await db.execute(query)).scalars().all()
    return [OrganizationRead.model_validate(org) for org in orgs]


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationRead:
    """Create a new organization and grant the authenticated user Owner role."""
    base_slug = slugify(data.slug or data.name)
    org_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    org = Organization(
        name=data.name.strip(),
        slug=org_slug,
        billing_plan="enterprise_trial",
    )
    db.add(org)
    await db.flush()

    membership = UserMembership(
        user_id=current_user.id,
        organization_id=org.id,
        role=RoleEnum.OWNER,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(org)

    return OrganizationRead.model_validate(org)


@router.get("/{org_id}/members", response_model=List[MemberRead])
async def list_organization_members(
    org_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[MemberRead]:
    """List members of the target organization. Requires active membership in org."""
    # Verify user belongs to org
    check_query = select(UserMembership).where(
        UserMembership.organization_id == org_id,
        UserMembership.user_id == current_user.id,
    )
    user_mem = (await db.execute(check_query)).scalar_one_or_none()
    if not user_mem:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not a member of this organization",
        )

    query = (
        select(UserMembership)
        .where(UserMembership.organization_id == org_id)
        .options(selectinload(UserMembership.user))
        .order_by(UserMembership.created_at.asc())
    )
    memberships = (await db.execute(query)).scalars().all()

    return [
        MemberRead(
            id=m.id,
            user_id=m.user_id,
            email=m.user.email,
            full_name=m.user.full_name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in memberships
    ]


@router.post("/{org_id}/members", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: uuid.UUID,
    data: MemberInvite,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MemberRead:
    """Invite a new or existing user to the organization. Requires Admin or Owner role."""
    if tenant.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Header tenant context does not match route organization ID",
        )

    # Check if user already exists
    user_query = select(User).where(User.email == data.email.lower().strip())
    user = (await db.execute(user_query)).scalar_one_or_none()

    if not user:
        # Create user account with randomized temporary password
        user = User(
            email=data.email.lower().strip(),
            hashed_password=get_password_hash(uuid.uuid4().hex),
            full_name=data.full_name or data.email.split("@")[0].title(),
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Check existing membership
    mem_query = select(UserMembership).where(
        UserMembership.organization_id == org_id,
        UserMembership.user_id == user.id,
    )
    existing_mem = (await db.execute(mem_query)).scalar_one_or_none()
    if existing_mem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization",
        )

    new_mem = UserMembership(
        user_id=user.id,
        organization_id=org_id,
        role=data.role,
    )
    db.add(new_mem)
    await db.commit()
    await db.refresh(new_mem)

    return MemberRead(
        id=new_mem.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=new_mem.role,
        created_at=new_mem.created_at,
    )


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a user from the organization. Requires Admin or Owner role."""
    if tenant.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Header tenant context does not match route organization ID",
        )

    query = select(UserMembership).where(
        UserMembership.organization_id == org_id,
        UserMembership.user_id == user_id,
    )
    membership = (await db.execute(query)).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in organization",
        )

    if membership.role == RoleEnum.OWNER and tenant.role != RoleEnum.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an Owner can remove another Owner",
        )

    await db.delete(membership)
    await db.commit()
