import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.user import RoleEnum, User, UserMembership
from app.core.security import create_access_token, get_password_hash


@pytest.mark.asyncio
async def test_incident_intake_validation(client: AsyncClient, tenant_a):
    """Validates incident intake requires title and raw_traceback, rejects invalid severity."""
    headers = tenant_a["headers"]
    org_id = tenant_a["org"].id

    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Billing Core", "slug": f"billing-core-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # Missing title
    res_empty_title = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={"title": "", "raw_traceback": "Traceback:\n  File 'a.py', line 1\nZeroDivisionError"},
    )
    assert res_empty_title.status_code == 422

    # Missing raw_traceback
    res_empty_tb = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={"title": "Error in billing", "raw_traceback": ""},
    )
    assert res_empty_tb.status_code == 422

    # Invalid severity
    res_bad_sev = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={"title": "Error in billing", "severity": "P9", "raw_traceback": "Traceback..."},
    )
    assert res_bad_sev.status_code == 422


@pytest.mark.asyncio
async def test_incident_secret_and_pii_sanitization(client: AsyncClient, tenant_a):
    """Asserts that sensitive API tokens, passwords, database URIs, emails, and credit cards are scrubbed."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Auth API", "slug": f"auth-api-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    dummy_gh = "gh" + "p_1234567890abcdefghijklmnopqrstuvwxyz"
    dummy_aws = "AK" + "IAIOSFODNN7EXAMPLE"
    dummy_db = "postgresql://" + "admin:SuperSecretPass123!@db.internal:5432/prod"

    raw_tb_with_secrets = (
        'Traceback (most recent call last):\n'
        '  File "src/auth/handler.py", line 42, in login\n'
        f'    token = "{dummy_gh}"\n'
        f'    aws_key = "{dummy_aws}"\n'
        f'    db_uri = "{dummy_db}"\n'
        '    user_email = "customer_vip@enterprise.com"\n'
        '    card = "4532-1234-5678-9012"\n'
        'ValueError: Invalid authorization payload\n'
    )

    res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": f"Auth failure with token {dummy_gh}",
            "description": "Customer customer_vip@enterprise.com experienced failure with password = 'SecretPassword99!'",
            "severity": "P1",
            "raw_traceback": raw_tb_with_secrets,
        },
    )
    assert res.status_code == 201
    data = res.json()

    # Verify title sanitized
    assert dummy_gh not in data["title"]
    assert "[REDACTED_API_TOKEN]" in data["title"]

    # Verify description sanitized
    assert "customer_vip@enterprise.com" not in data["description"]
    assert "[REDACTED_EMAIL]" in data["description"]
    assert "SecretPassword99!" not in data["description"]

    # Verify traceback sanitized
    assert dummy_gh not in data["raw_traceback"]
    assert dummy_aws not in data["raw_traceback"]
    assert "SuperSecretPass123!" not in data["raw_traceback"]
    assert "customer_vip@enterprise.com" not in data["raw_traceback"]
    assert "4532-1234-5678-9012" not in data["raw_traceback"]

    assert "[REDACTED_API_TOKEN]" in data["raw_traceback"]
    assert "[REDACTED_AWS_KEY]" in data["raw_traceback"]
    assert "[REDACTED_PASSWORD]" in data["raw_traceback"]
    assert "[REDACTED_EMAIL]" in data["raw_traceback"]
    assert "[REDACTED_CREDIT_CARD]" in data["raw_traceback"]


@pytest.mark.asyncio
async def test_incident_missing_context_handling(client: AsyncClient, tenant_a):
    """
    Asserts that when required code or reproduction details are unavailable,
    the system marks the incident as 'needs_more_info' and does NOT falsely claim reproduction.
    """
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Orders App", "slug": f"orders-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Ingest incident WITHOUT buggy_code
    res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "IndexError in order processor on empty batch",
            "severity": "P2",
            "raw_traceback": (
                'Traceback (most recent call last):\n'
                '  File "src/orders/processor.py", line 88, in process_batch\n'
                '    current = items[0]\n'
                'IndexError: list index out of range\n'
            ),
        },
    )
    assert res.status_code == 201
    data = res.json()

    assert data["verification_state"] == "needs_more_info"
    assert data["repro_code"] is None
    assert data["missing_details"] is not None
    assert "src/orders/processor.py" in data["missing_details"]
    assert data["uncertainty_score"] >= 0.8
    assert "IndexError" in data["hypothesis"]


@pytest.mark.asyncio
async def test_incident_ai_analysis_and_synthesis(client: AsyncClient, tenant_a):
    """Asserts that when buggy code is provided, AI generates a candidate reproduction test."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Prorate Service", "slug": f"prorate-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    buggy_code = (
        "def calculate_prorate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0) -> float:\n"
        "    daily_rate = total_cost / billing_cycle_days\n"
        "    return daily_rate * days_active\n"
    )

    raw_tb = (
        'Traceback (most recent call last):\n'
        '  File "src/billing/prorate.py", line 2, in calculate_prorate\n'
        '    daily_rate = total_cost / billing_cycle_days\n'
        'ZeroDivisionError: float division by zero\n'
    )

    res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "ZeroDivisionError in calculate_prorate on zero billing cycle days",
            "severity": "P0",
            "raw_traceback": raw_tb,
            "buggy_code": buggy_code,
        },
    )
    assert res.status_code == 201
    data = res.json()

    assert data["verification_state"] == "test_generated"
    assert data["repro_code"] is not None
    assert "test_reproduce_calculate_prorate" in data["repro_code"]
    assert "billing_cycle_days=0" in data["repro_code"]
    assert data["fault_module"] == "src/billing/prorate.py"
    assert data["fault_line"] == 2
    assert data["uncertainty_score"] < 0.5


@pytest.mark.asyncio
async def test_incident_dual_state_verification_success(client: AsyncClient, tenant_a):
    """
    Controlled Realistic Defect Example:
    State A: Test fails on buggy code reproducing ZeroDivisionError (Expected RED).
    State B: Test passes on corrected code with zero-check safeguard (Expected GREEN).
    """
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Billing Prorate Core", "slug": f"prorate-core-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    buggy_code = (
        "def calculate_prorate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0) -> float:\n"
        "    daily_rate = total_cost / billing_cycle_days\n"
        "    return daily_rate * days_active\n"
    )

    corrected_code = (
        "def calculate_prorate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0) -> float:\n"
        "    if billing_cycle_days <= 0:\n"
        "        return 0.0\n"
        "    daily_rate = total_cost / billing_cycle_days\n"
        "    return daily_rate * days_active\n"
    )

    raw_tb = (
        'Traceback (most recent call last):\n'
        '  File "src/billing/prorate.py", line 2, in calculate_prorate\n'
        '    daily_rate = total_cost / billing_cycle_days\n'
        'ZeroDivisionError: division by zero\n'
    )

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "ZeroDivisionError in calculate_prorate",
            "severity": "P0",
            "raw_traceback": raw_tb,
            "buggy_code": buggy_code,
            "corrected_code": corrected_code,
        },
    )
    assert inc_res.status_code == 201
    inc_id = inc_res.json()["id"]

    # Execute dual-state verification
    verify_res = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        headers=headers,
        json={"fixed_commit": "a1b2c3d"},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()

    assert v_data["verification_state"] == "verified_fixed"
    assert v_data["reproduction_proven"] is True
    assert v_data["fix_proven"] is True
    assert len(v_data["evidence_hash"]) == 64
    assert "ZeroDivisionError" in v_data["state_a_stderr"] or "FAILED" in v_data["state_a_stdout"]
    assert "PASSED" in v_data["state_b_stdout"] or "1 passed" in v_data["state_b_stdout"]

    # Verify incident record updated
    get_res = await client.get(f"/api/v1/incidents/{inc_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["verification_state"] == "verified_fixed"
    assert get_res.json()["evidence_hash"] == v_data["evidence_hash"]


@pytest.mark.asyncio
async def test_incident_failed_to_reproduce(client: AsyncClient, tenant_a):
    """Asserts that candidate test that passes on buggy code is marked failed_to_reproduce."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Dummy App", "slug": f"dummy-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "Hypothetical Bug",
            "severity": "P1",
            "raw_traceback": 'Traceback:\n  File "solution.py", line 1, in run\nValueError\n',
            "buggy_code": "def run():\n    return 42\n",
        },
    )
    inc_id = inc_res.json()["id"]

    # Trivial test that does not trigger any error on buggy code
    trivial_test = (
        "def test_trivial():\n"
        "    from solution import run\n"
        "    assert run() == 42\n"
    )

    verify_res = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        headers=headers,
        json={"candidate_test_code": trivial_test},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()

    assert v_data["verification_state"] == "failed_to_reproduce"
    assert v_data["reproduction_proven"] is False
    assert v_data["fix_proven"] is False


@pytest.mark.asyncio
async def test_incident_reproduction_without_corrected_code(client: AsyncClient, tenant_a):
    """Asserts that verifying buggy code without corrected code transitions to 'reproduced' state."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Repro Only App", "slug": f"repro-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    buggy_code = "def divide(a, b):\n    return a / b\n"
    test_code = (
        "import pytest\n"
        "def test_div_by_zero():\n"
        "    from solution import divide\n"
        "    assert divide(10, 0) == 0\n"
    )

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "Divide by zero",
            "severity": "P0",
            "raw_traceback": 'Traceback:\n  File "solution.py", line 2, in divide\nZeroDivisionError\n',
            "buggy_code": buggy_code,
        },
    )
    inc_id = inc_res.json()["id"]

    verify_res = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        headers=headers,
        json={"candidate_test_code": test_code},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()

    assert v_data["verification_state"] == "reproduced"
    assert v_data["reproduction_proven"] is True
    assert v_data["fix_proven"] is False
    assert "PENDING" in v_data["state_b_result"]


@pytest.mark.asyncio
async def test_incident_update_and_reanalyze(client: AsyncClient, tenant_a):
    """Asserts developer can update incident context and re-analyze to generate test."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Cache Service", "slug": f"cache-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Initial intake without code -> needs_more_info
    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "KeyError in cache",
            "severity": "P1",
            "raw_traceback": 'Traceback:\n  File "solution.py", line 2, in get_item\nKeyError: "session"\n',
        },
    )
    inc_id = inc_res.json()["id"]
    assert inc_res.json()["verification_state"] == "needs_more_info"

    # Developer provides buggy code
    update_res = await client.put(
        f"/api/v1/incidents/{inc_id}",
        headers=headers,
        json={"buggy_code": "def get_item(store):\n    return store['session']\n"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["buggy_code"] is not None

    # Re-analyze
    analyze_res = await client.post(
        f"/api/v1/incidents/{inc_id}/analyze",
        headers=headers,
    )
    assert analyze_res.status_code == 200
    a_data = analyze_res.json()
    assert a_data["verification_state"] == "test_generated"
    assert a_data["repro_code"] is not None
    assert "test_reproduce_get_item" in a_data["repro_code"]


@pytest.mark.asyncio
async def test_incident_promote_to_regression_catalog(client: AsyncClient, tenant_a):
    """Asserts verified incident test is promoted into test_cases catalog with provenance."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Catalog Test App", "slug": f"cat-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "ZeroDivisionError test",
            "severity": "P0",
            "raw_traceback": 'Traceback:\n  File "solution.py", line 1, in run\nZeroDivisionError\n',
            "buggy_code": "def run(x):\n    return 10 / x\n",
        },
    )
    inc_id = inc_res.json()["id"]

    # Promote test
    promote_res = await client.post(
        f"/api/v1/incidents/{inc_id}/promote",
        headers=headers,
        json={"name": "test_repro_zero_div_custom"},
    )
    assert promote_res.status_code == 200
    p_data = promote_res.json()
    assert p_data["incident_id"] == inc_id
    assert p_data["name"] == "test_repro_zero_div_custom"
    assert p_data["status"] == "verified"
    test_case_id = p_data["test_case_id"]

    # Confirm test case exists in project's test catalog
    tc_res = await client.get(f"/api/v1/projects/{proj_id}/test-cases", headers=headers)
    assert tc_res.status_code == 200
    cases = tc_res.json()
    assert any(c["id"] == test_case_id for c in cases)


@pytest.mark.asyncio
async def test_incident_tenant_isolation(client: AsyncClient, tenant_a, tenant_b):
    """Asserts Tenant B cannot view or verify Tenant A's incidents."""
    headers_a = tenant_a["headers"]
    headers_b = tenant_b["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers_a,
        json={"name": "Tenant A Secret App", "slug": f"secret-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id_a = proj_res.json()["id"]

    inc_res = await client.post(
        f"/api/v1/projects/{proj_id_a}/incidents",
        headers=headers_a,
        json={
            "title": "Tenant A Confidential Outage",
            "severity": "P0",
            "raw_traceback": 'Traceback:\n  File "solution.py", line 1\nException\n',
        },
    )
    inc_id_a = inc_res.json()["id"]

    # Tenant B tries to list Tenant A's incidents
    res_list = await client.get(f"/api/v1/projects/{proj_id_a}/incidents", headers=headers_b)
    assert res_list.status_code == 404

    # Tenant B tries to get Tenant A's incident
    res_get = await client.get(f"/api/v1/incidents/{inc_id_a}", headers=headers_b)
    assert res_get.status_code == 404

    # Tenant B tries to verify Tenant A's incident
    res_verify = await client.post(
        f"/api/v1/incidents/{inc_id_a}/verify",
        headers=headers_b,
        json={"candidate_test_code": "def test(): pass"},
    )
    assert res_verify.status_code == 404


@pytest.mark.asyncio
async def test_incident_rbac_authorization(client: AsyncClient, tenant_a, db_session: AsyncSession):
    """Asserts that users with VIEWER role are forbidden from creating or verifying incidents."""
    headers_owner = tenant_a["headers"]
    org = tenant_a["org"]

    # Create a viewer user in Org A
    uid = uuid.uuid4().hex[:6]
    viewer_user = User(
        email=f"viewer-{uid}@acme.com",
        hashed_password=get_password_hash("Password123!"),
        full_name="Viewer User",
        is_active=True,
    )
    db_session.add(viewer_user)
    await db_session.flush()

    membership = UserMembership(user_id=viewer_user.id, organization_id=org.id, role=RoleEnum.VIEWER)
    db_session.add(membership)
    await db_session.commit()

    viewer_token = create_access_token(
        subject=viewer_user.id,
        claims={"email": viewer_user.email, "org_id": str(org.id)},
    )
    viewer_headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Organization-ID": str(org.id),
    }

    # Owner creates project
    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers_owner,
        json={"name": "RBAC Project", "slug": f"rbac-{uuid.uuid4().hex[:6]}", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Viewer tries to intake incident -> 403 Forbidden
    create_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=viewer_headers,
        json={
            "title": "Viewer unauthorized attempt",
            "severity": "P1",
            "raw_traceback": "Traceback:\n  File 'a.py', line 1\nError",
        },
    )
    assert create_res.status_code == 403

    # Owner creates incident
    owner_inc = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers_owner,
        json={
            "title": "Owner incident",
            "severity": "P1",
            "raw_traceback": "Traceback:\n  File 'a.py', line 1\nError",
        },
    )
    inc_id = owner_inc.json()["id"]

    # Viewer tries to verify incident -> 403 Forbidden
    verify_res = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        headers=viewer_headers,
        json={"candidate_test_code": "def test(): pass"},
    )
    assert verify_res.status_code == 403
