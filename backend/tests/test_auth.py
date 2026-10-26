import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    payload = {
        "email": f"developer-{uid}@testblind.ai",
        "password": "StrongPassword2026!",
        "full_name": "Dev User",
        "organization_name": "Dev Org",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    payload = {
        "email": f"duplicate-{uid}@testblind.ai",
        "password": "Password123!",
        "full_name": "Initial User",
    }
    # First registration
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with identical email
    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    email = f"login-user-{uid}@testblind.ai"
    password = "CorrectPassword123!"

    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Login User"},
    )

    # Login
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    email = f"wrong-pw-{uid}@testblind.ai"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "OriginalPassword1!", "full_name": "User"},
    )

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, tenant_a):
    response = await client.get("/api/v1/auth/me", headers=tenant_a["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == tenant_a["user"].email
    assert len(data["memberships"]) >= 1
    assert data["memberships"][0]["role"] == "owner"


@pytest.mark.asyncio
async def test_missing_auth_header(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication token is missing" in response.json()["detail"]
