import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.user import RoleEnum, User, UserMembership


@pytest.mark.asyncio
async def test_rbac_viewer_permission_boundaries(client: AsyncClient, db_session: AsyncSession, tenant_a):
    uid = uuid.uuid4().hex[:6]
    # Create a viewer user in tenant_a's org
    viewer_user = User(
        email=f"viewer-{uid}@acme.com",
        hashed_password=get_password_hash("Password123!"),
        full_name=f"Vic Viewer {uid}",
        is_active=True,
    )
    db_session.add(viewer_user)
    await db_session.flush()

    mem = UserMembership(
        user_id=viewer_user.id,
        organization_id=tenant_a["org"].id,
        role=RoleEnum.VIEWER,
    )
    db_session.add(mem)
    await db_session.commit()

    viewer_token = create_access_token(
        subject=viewer_user.id,
        claims={"email": viewer_user.email, "org_id": str(tenant_a["org"].id)},
    )
    viewer_headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Organization-ID": str(tenant_a["org"].id),
    }

    # 1. Viewer can list projects (read-only)
    list_res = await client.get("/api/v1/projects", headers=viewer_headers)
    assert list_res.status_code == 200

    # 2. Viewer CANNOT create a project (requires Engineer or higher)
    create_res = await client.post(
        "/api/v1/projects",
        json={"name": "Forbidden Project", "framework": "pytest"},
        headers=viewer_headers,
    )
    assert create_res.status_code == 403
    assert "Insufficient permissions" in create_res.json()["detail"]


@pytest.mark.asyncio
async def test_rbac_engineer_cannot_invite_members(client: AsyncClient, db_session: AsyncSession, tenant_a):
    uid = uuid.uuid4().hex[:6]
    # Create an engineer user in tenant_a's org
    eng_user = User(
        email=f"engineer-{uid}@acme.com",
        hashed_password=get_password_hash("Password123!"),
        full_name=f"Eve Engineer {uid}",
        is_active=True,
    )
    db_session.add(eng_user)
    await db_session.flush()

    mem = UserMembership(
        user_id=eng_user.id,
        organization_id=tenant_a["org"].id,
        role=RoleEnum.ENGINEER,
    )
    db_session.add(mem)
    await db_session.commit()

    eng_token = create_access_token(
        subject=eng_user.id,
        claims={"email": eng_user.email, "org_id": str(tenant_a["org"].id)},
    )
    eng_headers = {
        "Authorization": f"Bearer {eng_token}",
        "X-Organization-ID": str(tenant_a["org"].id),
    }

    # Engineer CAN create projects
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": f"Engineer Proj {uid}", "framework": "pytest"},
        headers=eng_headers,
    )
    assert proj_res.status_code == 201

    # Engineer CANNOT invite members (requires Admin or Owner)
    invite_res = await client.post(
        f"/api/v1/organizations/{tenant_a['org'].id}/members",
        json={"email": f"new-hire-{uid}@acme.com", "role": "engineer"},
        headers=eng_headers,
    )
    assert invite_res.status_code == 403
    assert "Insufficient permissions" in invite_res.json()["detail"]


@pytest.mark.asyncio
async def test_rbac_admin_and_owner_can_invite_members(client: AsyncClient, tenant_a):
    uid = uuid.uuid4().hex[:6]
    # Owner can invite member
    invite_res = await client.post(
        f"/api/v1/organizations/{tenant_a['org'].id}/members",
        json={"email": f"invited-user-{uid}@acme.com", "role": "engineer"},
        headers=tenant_a["headers"],
    )
    assert invite_res.status_code == 201
    data = invite_res.json()
    assert data["email"] == f"invited-user-{uid}@acme.com"
    assert data["role"] == "engineer"
