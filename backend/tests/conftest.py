import os
import sys
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import Organization, RoleEnum, User, UserMembership


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        settings.async_database_url,
        echo=False,
        poolclass=NullPool,
    )
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def tenant_a(db_session: AsyncSession):
    """Fixture providing Tenant A (Organization A with Owner user)."""
    uid = uuid.uuid4().hex[:6]
    org = Organization(name=f"Acme Corp {uid}", slug=f"acme-{uid}", billing_plan="enterprise")
    user = User(
        email=f"owner-a-{uid}@acme.com",
        hashed_password=get_password_hash("SecretPassword123!"),
        full_name=f"Alice Acme {uid}",
        is_active=True,
    )
    db_session.add(org)
    db_session.add(user)
    await db_session.flush()

    mem = UserMembership(user_id=user.id, organization_id=org.id, role=RoleEnum.OWNER)
    db_session.add(mem)
    await db_session.commit()

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "org_id": str(org.id)},
    )
    return {
        "org": org,
        "user": user,
        "token": token,
        "headers": {
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": str(org.id),
        },
    }


@pytest_asyncio.fixture(scope="function")
async def tenant_b(db_session: AsyncSession):
    """Fixture providing Tenant B (Organization B with Owner user) for cross-tenant testing."""
    uid = uuid.uuid4().hex[:6]
    org = Organization(name=f"Beta Labs {uid}", slug=f"beta-{uid}", billing_plan="pro")
    user = User(
        email=f"owner-b-{uid}@beta.com",
        hashed_password=get_password_hash("SecretPassword123!"),
        full_name=f"Bob Beta {uid}",
        is_active=True,
    )
    db_session.add(org)
    db_session.add(user)
    await db_session.flush()

    mem = UserMembership(user_id=user.id, organization_id=org.id, role=RoleEnum.OWNER)
    db_session.add(mem)
    await db_session.commit()

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "org_id": str(org.id)},
    )
    return {
        "org": org,
        "user": user,
        "token": token,
        "headers": {
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": str(org.id),
        },
    }
