import re
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import Organization, RoleEnum, User, UserMembership
from app.schemas.auth import (
    MembershipOrgRead,
    Token,
    UserLogin,
    UserProfile,
    UserRead,
    UserRegister,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug or "org"


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Register a new user account, create their primary organization, and grant Owner role."""
    # Check if user with this email already exists
    existing_user_query = select(User).where(User.email == data.email.lower().strip())
    existing_user = (await db.execute(existing_user_query)).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists",
        )

    # Create User
    new_user = User(
        email=data.email.lower().strip(),
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name.strip(),
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Create Organization
    org_name = (data.organization_name or f"{data.full_name}'s Team").strip()
    base_slug = slugify(org_name)
    org_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    new_org = Organization(
        name=org_name,
        slug=org_slug,
        billing_plan="enterprise_trial",
    )
    db.add(new_org)
    await db.flush()

    # Create Owner Membership
    membership = UserMembership(
        user_id=new_user.id,
        organization_id=new_org.id,
        role=RoleEnum.OWNER,
    )
    db.add(membership)
    await db.commit()

    # Issue JWT Token
    access_token = create_access_token(
        subject=new_user.id,
        claims={"email": new_user.email, "org_id": str(new_org.id)},
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authenticate with email and password, issuing an access JWT."""
    query = (
        select(User)
        .where(User.email == credentials.email.lower().strip())
        .options(selectinload(User.memberships))
    )
    user = (await db.execute(query)).scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated",
        )

    primary_org_id = str(user.memberships[0].organization_id) if user.memberships else None

    access_token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "org_id": primary_org_id},
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserProfile:
    """Retrieve currently authenticated user identity and organization memberships."""
    query = (
        select(UserMembership)
        .where(UserMembership.user_id == current_user.id)
        .options(selectinload(UserMembership.organization))
    )
    memberships = (await db.execute(query)).scalars().all()

    membership_reads = [
        MembershipOrgRead(
            organization_id=m.organization_id,
            organization_name=m.organization.name,
            organization_slug=m.organization.slug,
            role=m.role.value,
        )
        for m in memberships
    ]

    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        created_at=current_user.created_at,
        memberships=membership_reads,
    )
