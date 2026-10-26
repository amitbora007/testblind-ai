import io
import uuid
import zipfile
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.models.user import RoleEnum


def make_zip_archive(files_dict: dict) -> bytes:
    """Helper to build in-memory zip bytes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in files_dict.items():
            zf.writestr(filename, content)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_zip_upload_valid_python_repo(client: AsyncClient, test_user_headers: dict):
    # 1. Create a project
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Auth Microservice", "framework": "pytest"},
        headers=test_user_headers,
    )
    assert create_resp.status_code == 201
    project_id = create_resp.json()["id"]

    # 2. Build Python project zip
    zip_bytes = make_zip_archive({
        "src/auth.py": "def login(u, p):\n    if u == 'admin' and p == 'secret':\n        return True\n    return False\n",
        "tests/test_auth.py": "from src.auth import login\ndef test_login():\n    assert login('admin', 'secret') is True\n",
        "requirements.txt": "pytest==8.2.2\nfastapi>=0.111.0\n",
        "pytest.ini": "[pytest]\npython_files = test_*.py\n",
    })

    # 3. Upload zip
    files = {"file": ("auth_repo.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 201
    data = upload_resp.json()

    assert data["detected_language"] == "python"
    assert data["detected_test_runner"] == "pytest"
    assert data["suggested_test_command"] == "pytest --tb=short tests/"
    assert data["source_files"] >= 1
    assert data["test_files"] >= 1
    assert any("src/auth.py" in m for m in data["file_manifest"])
    assert any("tests/test_auth.py" in m for m in data["file_manifest"])


@pytest.mark.asyncio
async def test_zip_upload_valid_typescript_repo(client: AsyncClient, test_user_headers: dict):
    # Create project
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Frontend Portal", "framework": "jest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    # Build TS project zip
    zip_bytes = make_zip_archive({
        "src/index.ts": "export function add(a: number, b: number): number { return a + b; }",
        "src/index.test.ts": "import { add } from './index'; test('adds', () => { expect(add(1, 2)).toBe(3); });",
        "package.json": '{"name": "frontend-portal", "scripts": {"test": "jest"}}',
        "tsconfig.json": '{"compilerOptions": {"target": "ES2022"}}',
        "jest.config.js": "module.exports = {};",
    })

    files = {"file": ("ts_project.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 201
    data = upload_resp.json()

    assert data["detected_language"] == "typescript"
    assert data["detected_test_runner"] == "jest"
    assert data["suggested_test_command"] == "npm test"


@pytest.mark.asyncio
async def test_zip_upload_invalid_non_zip_file(client: AsyncClient, test_user_headers: dict):
    # Create project
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Corrupted Target", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    # Plain text disguised with .zip extension (invalid magic bytes)
    fake_zip_bytes = b"This is plainly not a zip file header. Just plain ASCII bytes."
    files = {"file": ("malformed.zip", fake_zip_bytes, "application/zip")}

    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 400
    assert "Invalid file signature" in upload_resp.json()["detail"] or "invalid" in upload_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_zip_upload_malicious_path_traversal_zip_slip(client: AsyncClient, test_user_headers: dict):
    # Create project
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Security Target", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    # Craft Zip Slip attack payload targeting /etc/passwd
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../../../../../../../etc/passwd", "root:x:0:0:root:/root:/bin/bash\n")
        zf.writestr("legit_file.py", "print('hello')\n")
    malicious_bytes = buf.getvalue()

    files = {"file": ("zip_slip_exploit.zip", malicious_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 400
    assert "Security Alert" in upload_resp.json()["detail"] or "Zip Slip" in upload_resp.json()["detail"] or "traversal" in upload_resp.json()["detail"]


@pytest.mark.asyncio
async def test_zip_upload_unsupported_archive_type(client: AsyncClient, test_user_headers: dict):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Unsupported Extension", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    files = {"file": ("archive.tar.gz", b"fake tar content", "application/gzip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 400
    assert "Unsupported file format" in upload_resp.json()["detail"]


@pytest.mark.asyncio
async def test_zip_upload_retention_and_cleanup(client: AsyncClient, test_user_headers: dict):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Cleanup Test", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_resp.json()["id"]

    zip_bytes = make_zip_archive({
        "app.py": "print('hello')",
        "tests/test_app.py": "def test_hello(): assert True",
    })

    files = {"file": ("repo_to_clean.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=test_user_headers,
    )
    assert upload_resp.status_code == 201
    repo_id = upload_resp.json()["repository_id"]

    # Query structure
    struct_resp = await client.get(
        f"/api/v1/projects/{project_id}/repositories/{repo_id}/structure",
        headers=test_user_headers,
    )
    assert struct_resp.status_code == 200
    assert struct_resp.json()["detected_language"] == "python"

    # Purge scratch files
    delete_resp = await client.delete(
        f"/api/v1/projects/{project_id}/repositories/{repo_id}/upload",
        headers=test_user_headers,
    )
    assert delete_resp.status_code == 200
    assert "purged" in delete_resp.json()["message"].lower()


@pytest.mark.asyncio
async def test_github_status_unconfigured(client: AsyncClient, test_user_headers: dict, monkeypatch):
    # Ensure server credentials are unset
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", None)
    monkeypatch.setattr(settings, "GITHUB_CLIENT_SECRET", None)

    resp = await client.get("/api/v1/integrations/github/status", headers=test_user_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["configured"] is False
    assert data["connected"] is False
    assert data["setup_instructions"] is not None
    assert "GITHUB_CLIENT_ID" in data["setup_instructions"]


@pytest.mark.asyncio
async def test_github_connect_unconfigured_error(client: AsyncClient, test_user_headers: dict, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", None)
    monkeypatch.setattr(settings, "GITHUB_CLIENT_SECRET", None)

    resp = await client.post(
        "/api/v1/integrations/github/connect",
        json={"code": "temporary_code_123"},
        headers=test_user_headers,
    )
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_github_configured_workflow_and_linking(client: AsyncClient, test_user_headers: dict, monkeypatch):
    # Mock configured environment credentials
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "mock_github_client_id")
    monkeypatch.setattr(settings, "GITHUB_CLIENT_SECRET", "mock_github_client_secret")

    # Connect
    conn_resp = await client.post(
        "/api/v1/integrations/github/connect",
        json={"code": "valid_oauth_code"},
        headers=test_user_headers,
    )
    assert conn_resp.status_code == 200
    assert conn_resp.json()["connected"] is True

    # List repos
    repos_resp = await client.get("/api/v1/integrations/github/repos", headers=test_user_headers)
    assert repos_resp.status_code == 200
    repos = repos_resp.json()
    assert len(repos) >= 1
    assert repos[0]["full_name"] == "acme-corp/core-auth-service"

    # List branches
    branch_resp = await client.get(
        "/api/v1/integrations/github/repos/acme-corp/core-auth-service/branches",
        headers=test_user_headers,
    )
    assert branch_resp.status_code == 200
    branches = [b["name"] for b in branch_resp.json()]
    assert "main" in branches
    assert "develop" in branches

    # Create project and link GitHub repo
    create_proj = await client.post(
        "/api/v1/projects",
        json={"name": "GitHub Linked Project", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_proj.json()["id"]

    link_resp = await client.post(
        f"/api/v1/integrations/github/projects/{project_id}/link",
        json={"repo_url": "https://github.com/acme-corp/core-auth-service", "default_branch": "main"},
        headers=test_user_headers,
    )
    assert link_resp.status_code == 201
    assert link_resp.json()["repo_type"] == "github"


@pytest.mark.asyncio
async def test_repository_authorization_rbac(client: AsyncClient, test_user_headers: dict, db_session):
    # Create project as Admin/Engineer
    create_proj = await client.post(
        "/api/v1/projects",
        json={"name": "RBAC Repo Target", "framework": "pytest"},
        headers=test_user_headers,
    )
    project_id = create_proj.json()["id"]

    # Register a viewer user in the same organization
    viewer_email = f"viewer_repo_{uuid.uuid4().hex[:6]}@example.com"
    viewer_reg = await client.post(
        "/api/v1/auth/register",
        json={"email": viewer_email, "password": "Password123!", "full_name": "Viewer Repo"},
    )
    assert viewer_reg.status_code == 201
    viewer_token = viewer_reg.json()["access_token"]
    viewer_org_id = test_user_headers["X-Organization-ID"]

    # Downgrade user's role to VIEWER in the target organization
    from app.models.user import User, UserMembership
    from sqlalchemy import select

    viewer_user_query = select(User).where(User.email == viewer_email)
    viewer_user = (await db_session.execute(viewer_user_query)).scalar_one()

    membership = UserMembership(
        user_id=viewer_user.id,
        organization_id=uuid.UUID(viewer_org_id),
        role=RoleEnum.VIEWER,
    )
    db_session.add(membership)
    await db_session.commit()

    viewer_headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Organization-ID": viewer_org_id,
    }

    # Attempt upload as Viewer -> MUST return 403 Forbidden
    zip_bytes = make_zip_archive({"a.py": "pass"})
    files = {"file": ("test.zip", zip_bytes, "application/zip")}
    upload_resp = await client.post(
        f"/api/v1/projects/{project_id}/repositories/upload-zip",
        files=files,
        headers=viewer_headers,
    )
    assert upload_resp.status_code == 403
    assert "insufficient permissions" in upload_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_codelab_analyze_python_ast(client: AsyncClient, test_user_headers: dict):
    source = (
        "def discount(price: float) -> float:\n"
        "    if price > 100.0:\n"
        "        return 0.15\n"
        "    return 0.05\n"
    )
    resp = await client.post(
        "/api/v1/codelab/analyze",
        json={"source_code": source, "language": "python"},
        headers=test_user_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["language"] == "python"
    assert data["ast_nodes_count"] > 5
    assert len(data["functions"]) == 1
    assert data["functions"][0]["name"] == "discount"
    assert data["branches_count"] >= 1
    assert len(data["mutation_candidates"]) >= 1
    assert data["mutation_candidates"][0]["original_operator"] == ">"
    assert data["mutation_candidates"][0]["mutated_operator"] == ">="
    assert data["is_executable"] is False  # Source-only proposal


@pytest.mark.asyncio
async def test_codelab_synthesize_boundary_test(client: AsyncClient, test_user_headers: dict):
    source = "def discount(price: float) -> float:\n    if price > 100:\n        return 0.15\n    return 0.05\n"
    resp = await client.post(
        "/api/v1/codelab/synthesize",
        json={"source_code": source, "language": "python"},
        headers=test_user_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "def test_" in data["synthesized_test_code"]
    assert "assert " in data["synthesized_test_code"]
    assert data["is_executable"] is False  # Awaiting execution verification


@pytest.mark.asyncio
async def test_codelab_execute_sandbox(client: AsyncClient, test_user_headers: dict):
    source = (
        "def calculate_tier_discount(order_total: float, customer_tier: str) -> float:\n"
        "    if order_total <= 0:\n"
        "        raise ValueError('Order total must be positive')\n"
        "    if customer_tier == 'PLATINUM':\n"
        "        if order_total > 100.0:\n"
        "            return 0.15\n"
        "        return 0.05\n"
        "    return 0.0\n"
    )
    test = (
        "import pytest\n"
        "from solution import calculate_tier_discount\n\n"
        "def test_platinum_high():\n"
        "    assert calculate_tier_discount(150.0, 'PLATINUM') == 0.15\n\n"
        "def test_platinum_boundary():\n"
        "    assert calculate_tier_discount(100.0, 'PLATINUM') == 0.05\n\n"
        "def test_negative_raises():\n"
        "    with pytest.raises(ValueError):\n"
        "        calculate_tier_discount(-1.0, 'PLATINUM')\n"
    )

    resp = await client.post(
        "/api/v1/codelab/execute",
        json={"source_code": source, "test_code": test, "language": "python"},
        headers=test_user_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["exit_code"] == 0
    assert data["is_executable"] is True
    assert data["verified"] is True
    assert data["baseline_passed"] is True
    assert len(data["execution_hash"]) == 64  # SHA-256


@pytest.mark.asyncio
async def test_codelab_input_validation_empty_or_invalid(client: AsyncClient, test_user_headers: dict):
    # Empty code
    resp = await client.post(
        "/api/v1/codelab/analyze",
        json={"source_code": "   ", "language": "python"},
        headers=test_user_headers,
    )
    assert resp.status_code == 422

    # Syntax error in Python
    bad_syntax = "def broken(x: return 5\n"
    resp2 = await client.post(
        "/api/v1/codelab/analyze",
        json={"source_code": bad_syntax, "language": "python"},
        headers=test_user_headers,
    )
    assert resp2.status_code == 400
    assert "syntax error" in resp2.json()["detail"].lower()
