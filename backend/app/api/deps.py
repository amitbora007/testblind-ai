import uuid
from dataclasses import dataclass
from typing import Annotated, Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import Organization, RoleEnum, User, UserMembership

security_scheme = HTTPBearer(auto_error=False)

ROLE_LEVELS = {
    RoleEnum.OWNER: 4,
    RoleEnum.ADMIN: 3,
    RoleEnum.ENGINEER: 2,
    RoleEnum.VIEWER: 1,
}


@dataclass
class TenantContext:
    organization_id: uuid.UUID
    organization: Organization
    role: RoleEnum
    user: User


async def get_current_user(
    token_auth: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not token_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token_auth.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user identifier in token",
        )

    query = select(User).where(User.id == user_id, User.is_active.is_(True))
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account does not exist or has been disabled",
        )

    return user


async def get_tenant_context(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_organization_id: Annotated[Optional[str], Header()] = None,
) -> TenantContext:
    """
    Strict server-side tenant isolation:
    Derives or verifies the tenant context against user memberships.
    Never trusts an unverified client tenant ID.
    """
    target_org_id: Optional[uuid.UUID] = None

    if x_organization_id:
        try:
            target_org_id = uuid.UUID(x_organization_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Organization-ID header format. Must be a valid UUID.",
            )

    # Query memberships for the user with organization loaded
    query = (
        select(UserMembership)
        .where(UserMembership.user_id == current_user.id)
        .options(selectinload(UserMembership.organization))
    )
    if target_org_id:
        query = query.where(UserMembership.organization_id == target_org_id)

    result = await db.execute(query)
    membership = result.scalar_one_or_none()

    if not membership:
        if target_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not a member of the requested organization",
            )
        # If no org specified and no memberships exist
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any active organization",
        )

    return TenantContext(
        organization_id=membership.organization_id,
        organization=membership.organization,
        role=membership.role,
        user=current_user,
    )


async def get_optional_tenant_context(
    token_auth: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_organization_id: Annotated[Optional[str], Header()] = None,
) -> Optional[TenantContext]:
    """Resolves TenantContext if valid bearer credentials are provided; returns None otherwise."""
    if not token_auth or not token_auth.credentials:
        return None

    payload = decode_access_token(token_auth.credentials)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        return None

    query = select(User).where(User.id == user_id, User.is_active.is_(True))
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        return None

    target_org_id: Optional[uuid.UUID] = None
    if x_organization_id:
        try:
            target_org_id = uuid.UUID(x_organization_id)
        except ValueError:
            return None

    mem_query = (
        select(UserMembership)
        .where(UserMembership.user_id == user.id)
        .options(selectinload(UserMembership.organization))
    )
    if target_org_id:
        mem_query = mem_query.where(UserMembership.organization_id == target_org_id)

    membership = (await db.execute(mem_query)).scalar_one_or_none()
    if not membership:
        return None

    return TenantContext(
        organization_id=membership.organization_id,
        organization=membership.organization,
        role=membership.role,
        user=user,
    )


def require_role(min_role: RoleEnum):
    """Dependency factory enforcing minimum RBAC permission level."""

    def role_checker(
        tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    ) -> TenantContext:
        user_level = ROLE_LEVELS.get(tenant.role, 0)
        required_level = ROLE_LEVELS.get(min_role, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: Action requires '{min_role.value}' role or higher",
            )
        return tenant

    return role_checker
