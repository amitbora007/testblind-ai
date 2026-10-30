import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_and_readiness_endpoints(client: AsyncClient):
    # Liveness probe
    res_health = await client.get("/healthz")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # Readiness probe
    res_ready = await client.get("/readyz")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"
    assert res_ready.json()["database"] == "connected"


@pytest.mark.asyncio
async def test_project_and_repository_connection(client: AsyncClient, tenant_a):
    uid = uuid.uuid4().hex[:6]
    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        json={
            "name": f"Core Auth Service {uid}",
            "description": "Enterprise JWT identity and session service",
            "framework": "pytest",
            "default_branch": "main",
        },
        headers=tenant_a["headers"],
    )
    assert proj_res.status_code == 201
    proj_data = proj_res.json()
    proj_id = proj_data["id"]

    # Connect repository
    repo_res = await client.post(
        f"/api/v1/projects/{proj_id}/repository",
        json={
            "repo_type": "github",
            "repo_url": "https://github.com/acme-corp/core-auth",
            "default_branch": "main",
        },
        headers=tenant_a["headers"],
    )
    assert repo_res.status_code == 201
    repo_data = repo_res.json()
    assert repo_data["repo_type"] == "github"
    assert repo_data["project_id"] == proj_id


@pytest.mark.asyncio
async def test_scan_job_and_mutations_filtering(client: AsyncClient, tenant_a):
    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Billing Engine", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    # Trigger scan job
    scan_res = await client.post(
        f"/api/v1/projects/{proj_id}/scan-jobs",
        json={"branch": "main", "trigger": "manual"},
        headers=tenant_a["headers"],
    )
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    job_id = scan_data["id"]
    assert scan_data["total_mutants"] > 0
    assert scan_data["mutation_score"] >= 0.0

    # Query mutations without filter
    all_muts = await client.get(
        f"/api/v1/scan-jobs/{job_id}/mutations",
        headers=tenant_a["headers"],
    )
    assert all_muts.status_code == 200
    assert len(all_muts.json()) >= 3

    # Query mutations filtered by operator=ROR
    ror_muts = await client.get(
        f"/api/v1/scan-jobs/{job_id}/mutations?operator=ROR",
        headers=tenant_a["headers"],
    )
    assert ror_muts.status_code == 200
    assert len(ror_muts.json()) >= 1
    assert ror_muts.json()[0]["operator"] == "ROR"

    # Query findings
    findings = await client.get(
        f"/api/v1/scan-jobs/{job_id}/findings",
        headers=tenant_a["headers"],
    )
    assert findings.status_code == 200
    assert len(findings.json()) >= 1
    assert findings.json()[0]["finding_type"] == "mutation_gap"


@pytest.mark.asyncio
async def test_test_case_and_scenario_lifecycle(client: AsyncClient, tenant_a):
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Checkout Service", "framework": "vitest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    # Create Test Case
    case_res = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        json={
            "name": "Verify Coupon Discount Cap",
            "file_path": "tests/checkout/coupon.spec.ts",
            "function_name": "test_discount_cannot_exceed_subtotal",
            "framework": "vitest",
            "code": "test('discount cap', () => { expect(applyDiscount(100, 150)).toBe(100); });",
        },
        headers=tenant_a["headers"],
    )
    assert case_res.status_code == 201
    assert case_res.json()["name"] == "Verify Coupon Discount Cap"

    # Create Test Scenario
    scen_res = await client.post(
        f"/api/v1/projects/{proj_id}/test-scenarios",
        json={
            "name": "Cart Checkout with Prorated Tax",
            "requirement_code": "REQ-104",
            "description": "Validates cart checkout with discount voucher and sales tax.",
            "steps": [
                {"step": 1, "action": "Add item to cart", "assert": "Subtotal is 100"},
                {"step": 2, "action": "Apply voucher", "assert": "Discount is 20"},
            ],
            "timeout_seconds": 30,
        },
        headers=tenant_a["headers"],
    )
    assert scen_res.status_code == 201
    assert scen_res.json()["requirement_code"] == "REQ-104"


@pytest.mark.asyncio
async def test_incident_intake_and_dual_state_verification(client: AsyncClient, tenant_a):
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Invoicing Pipeline", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    buggy_code = (
        "def calculate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0):\n"
        "    daily_rate = total_cost / billing_cycle_days\n"
        "    return daily_rate * days_active\n"
    )
    corrected_code = (
        "def calculate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0):\n"
        "    if billing_cycle_days <= 0:\n"
        "        return 0.0\n"
        "    daily_rate = total_cost / billing_cycle_days\n"
        "    return daily_rate * days_active\n"
    )

    # Intake incident
    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        json={
            "title": "ZeroDivisionError in invoice prorate calculator on leap year",
            "severity": "P0",
            "raw_traceback": (
                'Traceback (most recent call last):\n'
                '  File "src/billing/prorate.py", line 76, in calculate\n'
                '    daily_rate = total_cost / billing_cycle_days\n'
                'ZeroDivisionError: float division by zero'
            ),
            "buggy_code": buggy_code,
            "corrected_code": corrected_code,
        },
        headers=tenant_a["headers"],
    )
    assert inc_res.status_code == 201
    inc_data = inc_res.json()
    inc_id = inc_data["id"]
    assert inc_data["fault_module"] == "src/billing/prorate.py"
    assert inc_data["fault_line"] == 76
    assert inc_data["verification_state"] == "test_generated"

    # Trigger dual-state verification
    verify_res = await client.post(
        f"/api/v1/incidents/{inc_id}/verify",
        json={"fixed_commit": "c47012b"},
        headers=tenant_a["headers"],
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["verification_state"] == "verified_fixed"
    assert verify_data["reproduction_proven"] is True
    assert verify_data["fix_proven"] is True
    assert "State A RED" in verify_data["state_a_result"]
    assert "State B GREEN" in verify_data["state_b_result"]


@pytest.mark.asyncio
async def test_dashboard_and_reports_metrics(client: AsyncClient, tenant_a):
    # Dashboard metrics
    dash_res = await client.get("/api/v1/dashboard/metrics", headers=tenant_a["headers"])
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "total_test_cases" in dash_data
    assert "requirement_coverage" in dash_data
    assert len(dash_data["execution_trends"]) == 4

    # Reports summary
    rep_res = await client.get("/api/v1/reports/summary", headers=tenant_a["headers"])
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert "overall_mutation_score" in rep_data
    assert "ROR" in rep_data["operators"]


@pytest.mark.asyncio
async def test_integrations_and_cli_token(client: AsyncClient, tenant_a):
    # Update GitHub integration
    int_res = await client.put(
        "/api/v1/integrations/github",
        json={"config": {"app_id": "48921045", "behavior": "inline_diff"}, "is_enabled": True},
        headers=tenant_a["headers"],
    )
    assert int_res.status_code == 200
    assert int_res.json()["provider"] == "github"

    # Generate CLI token
    cli_res = await client.post("/api/v1/integrations/cli-token", headers=tenant_a["headers"])
    assert cli_res.status_code == 200
    cli_data = cli_res.json()
    assert cli_data["token"].startswith("tb_runner_")
    assert "curl -fsSL https://get.testblind.ai" in cli_data["install_command"]

    # Test integration connection endpoint (GitHub success)
    test_res = await client.post(
        "/api/v1/integrations/github/test",
        json={"config": {"appId": "5492033", "repos": "locker"}},
        headers=tenant_a["headers"],
    )
    assert test_res.status_code == 200
    test_data = test_res.json()
    assert test_data["success"] is True
    assert "Connected to GitHub App Installation ID 5492033" in test_data["message"]
    assert test_data["latency_ms"] > 0

    # Test integration connection endpoint (missing credentials)
    fail_res = await client.post(
        "/api/v1/integrations/github/test",
        json={"config": {"appId": ""}},
        headers=tenant_a["headers"],
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["success"] is False
    assert "Installation ID is required" in fail_data["message"]

