import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident
from app.models.project import Project


@pytest.mark.asyncio
async def test_sentry_webhook_and_git_patch_flow(client: AsyncClient, db_session: AsyncSession, tenant_a):
    auth_headers = tenant_a["headers"]
    org = tenant_a["org"]

    # Ensure active project exists
    project_id = uuid.uuid4()
    proj = Project(
        id=project_id,
        organization_id=org.id,
        name="checkout-service",
        slug="checkout-service",
        default_branch="main",
    )
    db_session.add(proj)
    await db_session.commit()

    # 1. Ingest Sentry Webhook
    sentry_payload = {
        "id": "sentry-evt-9901",
        "project": "checkout-service",
        "message": "KeyError: 'discount_code'",
        "culprit": "app/services/checkout.py",
        "level": "error",
        "traceback": (
            "Traceback (most recent call last):\n"
            "  File \"app/services/checkout.py\", line 42, in apply_discount\n"
            "    code = request['discount_code']\n"
            "KeyError: 'discount_code'"
        ),
    }

    res = await client.post(
        "/api/v1/incidents/webhook/sentry",
        headers=auth_headers,
        json=sentry_payload,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["title"] == "KeyError: 'discount_code'"
    assert data["fault_module"] == "app/services/checkout.py"
    assert data["fault_line"] == 42
    incident_id = data["id"]

    # 2. Ingest Generic Webhook with Secret Sanitization
    generic_payload = {
        "title": "Database connection drop with auth token ghp_1234567890123456789012345",
        "raw_traceback": (
            "File \"app/db.py\", line 12, in connect\n"
            "  raise ConnectionError('Failed with ghp_1234567890123456789012345')"
        ),
        "severity": "critical",
        "project_name": "checkout-service",
    }
    res_generic = await client.post(
        "/api/v1/incidents/webhook/generic",
        headers=auth_headers,
        json=generic_payload,
    )
    assert res_generic.status_code == 201, res_generic.text
    generic_data = res_generic.json()
    # Secret must be redacted!
    assert "ghp_1234567890123456789012345" not in generic_data["title"]
    assert "[REDACTED_API_TOKEN]" in generic_data["title"]

    # 3. Export Git Patch for Incident with Repro Code
    inc = await db_session.get(Incident, uuid.UUID(incident_id))
    inc.repro_code = (
        "import pytest\n"
        "from app.services.checkout import apply_discount\n\n"
        "def test_missing_discount_code_raises_cleanly():\n"
        "    with pytest.raises(KeyError):\n"
        "        apply_discount({})\n"
    )
    inc.verification_state = "reproduced"
    inc.evidence_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    await db_session.commit()

    # Call export-patch JSON endpoint
    patch_res = await client.post(
        f"/api/v1/incidents/{incident_id}/export-patch",
        headers=auth_headers,
    )
    assert patch_res.status_code == 200, patch_res.text
    patch_json = patch_res.json()
    assert "diff --git" in patch_json["patch_content"]
    assert "+++ b/tests/test_incident_" in patch_json["patch_content"]
    assert "fix(regression): Add verified reproduction test" in patch_json["pr_title"]
    assert patch_json["evidence_hash"] == inc.evidence_hash

    # Call raw .diff endpoint for direct download
    raw_res = await client.get(
        f"/api/v1/incidents/{incident_id}/export-patch.diff",
        headers=auth_headers,
    )
    assert raw_res.status_code == 200
    assert "diff --git" in raw_res.text
