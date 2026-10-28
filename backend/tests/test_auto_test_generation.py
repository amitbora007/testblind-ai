import io
import uuid
import zipfile
import pytest
from httpx import AsyncClient


def make_zip_archive(files_dict: dict) -> bytes:
    """Helper to build in-memory zip bytes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in files_dict.items():
            zf.writestr(filename, content)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_zip_upload_auto_generate_tests_on_zero_tests(client: AsyncClient, test_user_headers: dict):
    """
    Verifies that uploading a repository with 0 tests automatically synthesizes
    test cases and test scenarios when auto_generate_if_no_tests is enabled.
    """
    # 1. Create a project
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Payment Calculator Service", "framework": "pytest"},
        headers=test_user_headers,
    )
    assert create_resp.status_code == 201
    project_id = create_resp.json()["id"]

    # 2. Build Python project zip with source files but NO tests
    zip_bytes = make_zip_archive({
        "calculator.py": (
            "def calculate_tax(amount: float, rate: float = 0.05) -> float:\n"
            "    if amount <= 0:\n"
            "        raise ValueError('Amount must be positive')\n"
            "    return amount * rate\n\n"
            "def calculate_discount(total: float) -> float:\n"
            "    if total > 100:\n"
            "        return total * 0.10\n"
            "    return 0.0\n"
        ),
        "requirements.txt": "pytest>=8.0.0\n",
    })

    # 3. Upload zip with auto_generate_if_no_tests=true
    files = {"file": ("payment_calc.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip?auto_generate_if_no_tests=true",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 201
    data = upload_resp.json()

    assert data["auto_generated_tests"] is True
    assert data["generated_test_cases_count"] >= 2
    assert data["generated_scenarios_count"] >= 2
    assert "automatically synthesized" in data["message"].lower()

    # 4. Verify test cases were persisted to the database
    tc_resp = await client.get(
        f"/api/v1/projects/{project_id}/test-cases",
        headers=test_user_headers,
    )
    assert tc_resp.status_code == 200
    test_cases = tc_resp.json()
    assert len(test_cases) == data["generated_test_cases_count"]
    assert any("calculate_tax" in tc["name"] or "calculate_discount" in tc["name"] for tc in test_cases)

    # 5. Verify test scenarios were persisted to the database
    sc_resp = await client.get(
        f"/api/v1/projects/{project_id}/test-scenarios",
        headers=test_user_headers,
    )
    assert sc_resp.status_code == 200
    scenarios = sc_resp.json()
    assert len(scenarios) == data["generated_scenarios_count"]
    assert any("REQ-AUTO" in s["requirement_code"] for s in scenarios)


@pytest.mark.asyncio
async def test_zip_upload_skip_auto_generate_when_disabled(client: AsyncClient, test_user_headers: dict):
    """
    Verifies that when auto_generate_if_no_tests is False, no tests are created.
    """
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Zero Test Project", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    zip_bytes = make_zip_archive({
        "app.py": "def hello():\n    return 'world'\n",
    })

    files = {"file": ("app.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip?auto_generate_if_no_tests=false",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 201
    data = upload_resp.json()

    assert data["auto_generated_tests"] is False
    assert data["generated_test_cases_count"] == 0
    assert data["test_files"] == 0

    # Ensure no test cases in database
    tc_resp = await client.get(
        f"/api/v1/projects/{project_id}/test-cases",
        headers=test_user_headers,
    )
    assert tc_resp.status_code == 200
    assert len(tc_resp.json()) == 0


@pytest.mark.asyncio
async def test_direct_auto_generate_endpoint_and_idempotency(client: AsyncClient, test_user_headers: dict):
    """
    Verifies POST /api/v1/projects/{project_id}/auto-generate-tests endpoint
    and its idempotency behavior.
    """
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Order Management Hub", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    # Call auto-generate directly
    gen_resp = await client.post(
        f"/api/v1/projects/{project_id}/auto-generate-tests",
        json={"create_test_cases": True, "create_scenarios": True, "force": False},
        headers=test_user_headers,
    )
    assert gen_resp.status_code == 201
    gen_data = gen_resp.json()
    assert gen_data["test_cases_created"] >= 3
    assert gen_data["scenarios_created"] >= 3

    # Call again without force: should report already has tests
    gen_resp2 = await client.post(
        f"/api/v1/projects/{project_id}/auto-generate-tests",
        json={"create_test_cases": True, "create_scenarios": True, "force": False},
        headers=test_user_headers,
    )
    assert gen_resp2.status_code == 201
    gen_data2 = gen_resp2.json()
    assert gen_data2["test_cases_created"] == 0
    assert gen_data2["scenarios_created"] == 0
    assert "already has" in gen_data2["message"]
