import uuid
import pytest
from httpx import AsyncClient
from app.services.regression_service import RegressionService


@pytest.mark.asyncio
async def test_codelab_warning_resolved(client: AsyncClient, tenant_a):
    """Verify CodeLab empty input returns HTTP 422 with zero Starlette deprecation warnings."""
    res = await client.post(
        "/api/v1/codelab/analyze",
        json={"source_code": "   ", "language": "python"},
        headers=tenant_a["headers"],
    )
    assert res.status_code == 422
    assert "Source code cannot be empty" in res.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_test_detection(client: AsyncClient, tenant_a):
    """Verify duplicate test detection via code hash and duplicate check endpoint."""
    headers = tenant_a["headers"]

    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Duplicate Detector Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    code_original = """def test_discount_cap():
    # Verify that discount never exceeds subtotal
    subtotal = 100.0
    discount = 150.0
    assert min(subtotal, discount) == 100.0
"""

    code_duplicate_with_extra_comments = """
# Author: QA Engineer
def test_discount_cap():
    # Different comment, identical normalized code
    subtotal = 100.0
    discount = 150.0
    assert min(subtotal, discount) == 100.0
"""

    # Check duplicate on empty project -> false
    check1 = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases/duplicate-check",
        headers=headers,
        json={"code": code_original},
    )
    assert check1.status_code == 200
    assert check1.json()["is_duplicate"] is False

    # Create first test case
    tc1 = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_discount_cap_v1",
            "file_path": "tests/test_discounts.py",
            "function_name": "test_discount_cap",
            "code": code_original,
            "test_type": "boundary_check",
        },
    )
    assert tc1.status_code == 201
    tc1_id = tc1.json()["id"]

    # Check duplicate with comments variation -> true
    check2 = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases/duplicate-check",
        headers=headers,
        json={"code": code_duplicate_with_extra_comments},
    )
    assert check2.status_code == 200
    assert check2.json()["is_duplicate"] is True
    assert check2.json()["duplicate_test_case_id"] == tc1_id

    # Attempting to insert duplicate returns existing test case
    tc2 = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_discount_cap_v2_duplicate",
            "file_path": "tests/test_discounts.py",
            "function_name": "test_discount_cap",
            "code": code_duplicate_with_extra_comments,
        },
    )
    assert tc2.status_code == 201
    assert tc2.json()["id"] == tc1_id


@pytest.mark.asyncio
async def test_save_and_run_cataloged_test_in_sandbox(client: AsyncClient, tenant_a):
    """
    End-to-End Test:
    1. Save a generated test with incident provenance and mutation links.
    2. Run it in an isolated sandbox.
    3. Inspect execution results and verify evidence hash.
    4. Export the test file.
    """
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Sandbox Test Runner Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Create incident for provenance
    inc_res = await client.post(
        f"/api/v1/projects/{proj_id}/incidents",
        headers=headers,
        json={
            "title": "Division by Zero in Invoice Generator",
            "severity": "P0",
            "description": "Zero days proration",
            "raw_traceback": 'Traceback (most recent call last):\n  File "billing.py", line 12, in prorate\n    return total / days\nZeroDivisionError: division by zero',
        },
    )
    assert inc_res.status_code == 201
    inc_id = inc_res.json()["id"]

    test_code = """def test_prorate_zero_days_protection():
    days = 0
    total = 100.0
    res = 0.0 if days == 0 else total / days
    assert res == 0.0
"""

    # 1. Save generated test
    create_res = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_prorate_zero_days_protection",
            "file_path": "tests/billing/test_prorate.py",
            "function_name": "test_prorate_zero_days_protection",
            "framework": "pytest",
            "code": test_code,
            "test_type": "incident_regression",
            "source_incident_id": inc_id,
            "branch": "main",
            "commit_sha": "a1b2c3d4",
            "review_status": "pending_review",
            "gap_resolved": True,
        },
    )
    assert create_res.status_code == 201
    tc = create_res.json()
    assert tc["source_incident_id"] == inc_id
    assert tc["test_type"] == "incident_regression"
    assert tc["review_status"] == "pending_review"
    tc_id = tc["id"]

    # 2. Run test in isolated execution sandbox
    run_res = await client.post(
        f"/api/v1/test-cases/{tc_id}/run",
        headers=headers,
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["test_case_id"] == tc_id
    assert run_data["exit_code"] == 0
    assert run_data["status"] == "verified"
    assert len(run_data["evidence_hash"]) == 64

    # 3. Inspect updated test case details and execution history
    inspect_res = await client.get(f"/api/v1/test-cases/{tc_id}", headers=headers)
    assert inspect_res.status_code == 200
    updated_tc = inspect_res.json()
    assert updated_tc["status"] == "verified"
    assert updated_tc["evidence_hash"] == run_data["evidence_hash"]
    assert len(updated_tc["execution_history"]) >= 1
    assert updated_tc["execution_history"][-1]["exit_code"] == 0

    # 4. Export test as downloadable .py file
    export_res = await client.get(f"/api/v1/test-cases/{tc_id}/export", headers=headers)
    assert export_res.status_code == 200
    assert "attachment;" in export_res.headers["content-disposition"]
    assert "test_prorate_zero_days_protection.py" in export_res.headers["content-disposition"]
    assert "def test_prorate_zero_days_protection" in export_res.text


@pytest.mark.asyncio
async def test_test_case_review_and_approval_workflow(client: AsyncClient, tenant_a):
    """Verify test review workflow: pending_review -> approved and rejected states."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Review Workflow Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    tc_res = await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_candidate_invariant",
            "file_path": "tests/test_candidate.py",
            "function_name": "test_candidate",
            "code": "def test_candidate(): assert True",
            "review_status": "pending_review",
        },
    )
    tc_id = tc_res.json()["id"]

    # Approve test case
    appr_res = await client.put(
        f"/api/v1/test-cases/{tc_id}/review",
        headers=headers,
        json={"review_status": "approved", "reviewed_by": "lead_qa@acme.com"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["review_status"] == "approved"
    assert appr_res.json()["reviewed_by"] == "lead_qa@acme.com"
    assert appr_res.json()["reviewed_at"] is not None

    # Reject test case
    rej_res = await client.put(
        f"/api/v1/test-cases/{tc_id}/review",
        headers=headers,
        json={"review_status": "rejected", "reviewed_by": "architect@acme.com"},
    )
    assert rej_res.status_code == 200
    assert rej_res.json()["review_status"] == "rejected"


@pytest.mark.asyncio
async def test_test_cases_filtering_and_grouping(client: AsyncClient, tenant_a):
    """Verify test case search, type filtering, and group_by response."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Grouping & Filter Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Add 2 test cases with different types
    await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_auth_jwt_signature",
            "file_path": "tests/auth/test_jwt.py",
            "function_name": "test_jwt",
            "code": "def test_auth_jwt_signature(): assert 'bearer' in 'bearer_token'",
            "test_type": "mutation_killer",
            "repository_name": "repo-auth",
        },
    )
    await client.post(
        f"/api/v1/projects/{proj_id}/test-cases",
        headers=headers,
        json={
            "name": "test_billing_tax_rounding",
            "file_path": "tests/billing/test_tax.py",
            "function_name": "test_tax",
            "code": "def test_billing_tax_rounding(): assert round(10.555, 2) == 10.56",
            "test_type": "incident_regression",
            "repository_name": "repo-billing",
        },
    )

    # Search by text
    search_res = await client.get(
        f"/api/v1/projects/{proj_id}/test-cases?search=tax_rounding",
        headers=headers,
    )
    assert search_res.status_code == 200
    assert len(search_res.json()) == 1
    assert search_res.json()[0]["name"] == "test_billing_tax_rounding"

    # Filter by test_type
    type_res = await client.get(
        f"/api/v1/projects/{proj_id}/test-cases?test_type=mutation_killer",
        headers=headers,
    )
    assert type_res.status_code == 200
    assert len(type_res.json()) == 1
    assert type_res.json()[0]["name"] == "test_auth_jwt_signature"

    # Group by repository
    grouped_res = await client.get(
        f"/api/v1/projects/{proj_id}/test-cases?group_by=repository",
        headers=headers,
    )
    assert grouped_res.status_code == 200
    g_data = grouped_res.json()
    assert g_data["grouped_by"] == "repository"
    assert "repo-auth" in g_data["groups"]
    assert "repo-billing" in g_data["groups"]


@pytest.mark.asyncio
async def test_execution_runs_filtering_sorting_and_pagination(client: AsyncClient, tenant_a):
    """Verify execution runs list with status filter, sorting, and pagination."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Pagination Runs Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # Create 3 runs
    for i in range(3):
        await client.post(
            f"/api/v1/projects/{proj_id}/execution-runs",
            headers=headers,
            json={"trigger": "manual", "branch": f"feature-{i}"},
        )

    # Test pagination
    paginated_res = await client.get(
        f"/api/v1/projects/{proj_id}/execution-runs?page=1&page_size=2",
        headers=headers,
    )
    assert paginated_res.status_code == 200
    page_data = paginated_res.json()
    assert "items" in page_data
    assert len(page_data["items"]) == 2
    assert page_data["total"] >= 3
    assert page_data["page"] == 1
    assert page_data["total_pages"] >= 2

    # Single run detail check
    run_id = page_data["items"][0]["id"]
    detail_res = await client.get(f"/api/v1/execution-runs/{run_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == run_id
    assert "tests_skipped" in detail
    assert "tests_blocked" in detail
    assert "duration_ms" in detail


@pytest.mark.asyncio
async def test_unified_reports_and_csv_json_export(client: AsyncClient, tenant_a):
    """Verify unified report aggregation and CSV/JSON export downloads."""
    headers = tenant_a["headers"]

    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Reporting Proj", "framework": "pytest"},
    )
    proj_id = proj_res.json()["id"]

    # 1. Unified report endpoint
    report_res = await client.get(
        f"/api/v1/reports/unified?project_id={proj_id}",
        headers=headers,
    )
    assert report_res.status_code == 200
    report = report_res.json()
    assert "mutation_effectiveness" in report
    assert "test_generation" in report
    assert "execution_history" in report
    assert "recurring_incidents" in report

    # 2. Export CSV
    csv_res = await client.get(
        f"/api/v1/reports/export?format=csv&project_id={proj_id}",
        headers=headers,
    )
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "attachment;" in csv_res.headers["content-disposition"]
    assert "testblind_unified_report.csv" in csv_res.headers["content-disposition"]
    assert "MUTATION EFFECTIVENESS" in csv_res.text
    assert "TEST LIBRARY & GENERATION" in csv_res.text

    # 3. Export JSON
    json_res = await client.get(
        f"/api/v1/reports/export?format=json&project_id={proj_id}",
        headers=headers,
    )
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers["content-type"]
    assert "attachment;" in json_res.headers["content-disposition"]
    assert "testblind_unified_report.json" in json_res.headers["content-disposition"]


@pytest.mark.asyncio
async def test_ai_insights_evidence_and_uncertainty(client: AsyncClient, tenant_a):
    """Verify AI insights provide concrete evidence, uncertainty, and verification state."""
    headers = tenant_a["headers"]

    res = await client.get("/api/v1/ai-insights", headers=headers)
    assert res.status_code == 200
    insights = res.json()
    assert len(insights) >= 2

    for ins in insights:
        assert "evidence" in ins
        assert isinstance(ins["evidence"], dict)
        assert "uncertainty" in ins
        assert "score" in ins["uncertainty"]
        assert "level" in ins["uncertainty"]
        assert "verification_state" in ins
        assert ins["verification_state"] == "verified_in_sandbox"
        assert "calibration_disclaimer" in ins
        assert "not a calibrated probability" in ins["calibration_disclaimer"]


@pytest.mark.asyncio
async def test_ci_contract_and_run_trigger(client: AsyncClient, tenant_a):
    """Verify CI integration contract, workflow template, and authenticated CI run trigger."""
    headers = tenant_a["headers"]

    # 1. CI Contract
    contract_res = await client.get("/api/v1/ci/contract", headers=headers)
    assert contract_res.status_code == 200
    contract = contract_res.json()
    assert "integrations" in contract
    gh_integration = next(i for i in contract["integrations"] if i["name"] == "GitHub Actions")
    assert gh_integration["status"] == "functional_and_configured"
    gitlab_integration = next(i for i in contract["integrations"] if i["name"] == "GitLab CI")
    assert gitlab_integration["status"] == "planned"

    # 2. Workflow Template download
    wf_res = await client.get("/api/v1/ci/workflow-template", headers=headers)
    assert wf_res.status_code == 200
    assert "text/yaml" in wf_res.headers["content-type"]
    assert "TestBlind Unified Regression Protection" in wf_res.text

    # 3. Trigger CI Run with X-TestBlind-Token
    ci_trigger_res = await client.post(
        "/api/v1/ci/runs",
        headers={"X-TestBlind-Token": "tb_runner_1234567890abcdef12345678"},
        json={
            "repository_url": "https://github.com/acme/backend-service",
            "branch": "feat/payment-barrier",
            "commit_sha": "d4e5f6a7",
            "pr_number": 42,
            "trigger_source": "github_actions",
        },
    )
    assert ci_trigger_res.status_code == 201
    ci_data = ci_trigger_res.json()
    assert ci_data["status"] == "passed"
    assert ci_data["branch"] == "feat/payment-barrier"
    assert ci_data["tests_passed"] == 8
    assert len(ci_data["evidence_hash"]) == 64


@pytest.mark.asyncio
async def test_tenant_isolation_unified_regression(client: AsyncClient, tenant_a, tenant_b):
    """Verify strict tenant isolation across test cases, execution runs, and reports."""
    headers_a = tenant_a["headers"]
    headers_b = tenant_b["headers"]

    proj_a = (
        await client.post(
            "/api/v1/projects",
            headers=headers_a,
            json={"name": "Tenant A Secret Project", "framework": "pytest"},
        )
    ).json()["id"]

    tc_a = (
        await client.post(
            f"/api/v1/projects/{proj_a}/test-cases",
            headers=headers_a,
            json={
                "name": "test_tenant_a_secret_logic",
                "file_path": "tests/secret.py",
                "function_name": "test_secret",
                "code": "def test_secret(): assert 'private' == 'private'",
            },
        )
    ).json()["id"]

    # Tenant B attempts to read Tenant A's test cases list -> 404
    cross_list = await client.get(f"/api/v1/projects/{proj_a}/test-cases", headers=headers_b)
    assert cross_list.status_code == 404

    # Tenant B attempts to read Tenant A's single test case -> 404
    cross_tc = await client.get(f"/api/v1/test-cases/{tc_a}", headers=headers_b)
    assert cross_tc.status_code == 404

    # Tenant B attempts to execute Tenant A's test case -> 404
    cross_run = await client.post(f"/api/v1/test-cases/{tc_a}/run", headers=headers_b)
    assert cross_run.status_code == 404
