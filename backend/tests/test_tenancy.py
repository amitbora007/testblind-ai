import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cross_tenant_project_isolation(client: AsyncClient, tenant_a, tenant_b):
    # 1. Tenant A creates Project Alpha
    res_a = await client.post(
        "/api/v1/projects",
        json={"name": "Project Alpha", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    assert res_a.status_code == 201
    proj_a_id = res_a.json()["id"]

    # 2. Tenant B creates Project Beta
    res_b = await client.post(
        "/api/v1/projects",
        json={"name": "Project Beta", "framework": "vitest"},
        headers=tenant_b["headers"],
    )
    assert res_b.status_code == 201
    proj_b_id = res_b.json()["id"]

    # 3. Tenant A listing projects: must ONLY see Project Alpha
    list_a = await client.get("/api/v1/projects", headers=tenant_a["headers"])
    assert list_a.status_code == 200
    ids_a = [p["id"] for p in list_a.json()]
    assert proj_a_id in ids_a
    assert proj_b_id not in ids_a

    # 4. Tenant B listing projects: must ONLY see Project Beta
    list_b = await client.get("/api/v1/projects", headers=tenant_b["headers"])
    assert list_b.status_code == 200
    ids_b = [p["id"] for p in list_b.json()]
    assert proj_b_id in ids_b
    assert proj_a_id not in ids_b

    # 5. Direct access to another tenant's project: must return 404 Not Found
    cross_read = await client.get(f"/api/v1/projects/{proj_b_id}", headers=tenant_a["headers"])
    assert cross_read.status_code == 404
    assert "Project not found" in cross_read.json()["detail"]


@pytest.mark.asyncio
async def test_forged_organization_header_rejected(client: AsyncClient, tenant_a, tenant_b):
    """
    Tenant A attempts to forge X-Organization-ID header using Tenant B's organization ID.
    The server MUST reject with 403 Forbidden and never trust the header.
    """
    forged_headers = {
        "Authorization": tenant_a["headers"]["Authorization"],
        "X-Organization-ID": str(tenant_b["org"].id),
    }

    res = await client.get("/api/v1/projects", headers=forged_headers)
    assert res.status_code == 403
    assert "You are not a member of the requested organization" in res.json()["detail"]


@pytest.mark.asyncio
async def test_cross_tenant_incident_isolation(client: AsyncClient, tenant_a, tenant_b):
    # Tenant A creates project and incident
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Auth Service A", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        json={
            "title": "Confidential ZeroDay Incident",
            "severity": "P0",
            "raw_traceback": 'File "src/auth/jwt.py", line 14\nZeroDivisionError',
        },
        headers=tenant_a["headers"],
    )
    assert inc_res.status_code == 201
    inc_id = inc_res.json()["id"]

    # Tenant B attempts to read Tenant A's incidents -> 404 Not Found
    cross_inc_list = await client.get(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=tenant_b["headers"],
    )
    assert cross_inc_list.status_code == 404

    # Tenant B attempts to trigger dual-state verification on Tenant A's incident -> 404 Not Found
    cross_verify = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        json={"buggy_commit": "c1", "fixed_commit": "c2"},
        headers=tenant_b["headers"],
    )
    assert cross_verify.status_code == 404
    assert "Incident not found" in cross_verify.json()["detail"]


@pytest.mark.asyncio
async def test_cross_tenant_execution_run_logs_isolation(client: AsyncClient, tenant_a, tenant_b):
    # Tenant A creates project and triggers run
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Data Pipeline A", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    run_res = await client.post(
        f"/api/v1/projects/{proj_id}/execution-runs",
        json={"trigger": "manual", "branch": "main"},
        headers=tenant_a["headers"],
    )
    assert run_res.status_code == 201
    run_id = run_res.json()["id"]

    # Tenant A can read run logs
    logs_a = await client.get(f"/api/v1/execution-runs/{run_id}/logs", headers=tenant_a["headers"])
    assert logs_a.status_code == 200
    assert "Ephemeral container provisioned" in logs_a.json()["stdout_log"]

    # Tenant B CANNOT read Tenant A's logs
    logs_b = await client.get(f"/api/v1/execution-runs/{run_id}/logs", headers=tenant_b["headers"])
    assert logs_b.status_code == 404
    assert "Execution run not found" in logs_b.json()["detail"]
