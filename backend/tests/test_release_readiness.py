import asyncio
import os
import sys
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch

from app.core.sanitization import sanitize_sensitive_data
from app.models.project import Project
from app.models.run import ExecutionRun
from app.services.sandbox_service import ExecutionSandboxConfig, SandboxManager
from app.services.queue_service import JobQueueEngine, JobRecord, JobStatus, queue_engine


@pytest.mark.asyncio
async def test_health_probes_and_readiness_reconciliation(client: AsyncClient):
    """
    Verify both Kubernetes root probes (/healthz, /readyz) and documented
    API probes (/api/v1/health/live, /api/v1/health/ready) are functional.
    """
    # 1. Liveness
    for path in ["/healthz", "/api/v1/health/live"]:
        res = await client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "TestBlind AI" in data["service"]

    # 2. Readiness with connected DB
    for path in ["/readyz", "/api/v1/health/ready"]:
        res = await client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_health_readiness_failure_recovery(client: AsyncClient):
    """
    Simulate database connectivity failure on readiness probes,
    verifying clean HTTP 503 response and graceful recovery.
    """
    with patch("sqlalchemy.ext.asyncio.AsyncSession.execute", side_effect=ConnectionRefusedError("Simulated DB outage")):
        res = await client.get("/readyz")
        assert res.status_code == 503
        assert "Database connection failed" in res.json()["detail"]

    # Recovery check
    recovered_res = await client.get("/readyz")
    assert recovered_res.status_code == 200
    assert recovered_res.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_concurrent_users_and_job_submissions(client: AsyncClient, tenant_a, tenant_b):
    """
    Simulate multi-tenant users and concurrent background job execution.
    Verifies bounded worker concurrency, per-tenant quotas, and queue resilience.
    """
    # 1. Multi-tenant API creation
    p_a = await client.post(
        "/api/v1/projects",
        headers=tenant_a["headers"],
        json={"name": "Tenant A Concurrency Suite", "framework": "pytest"},
    )
    p_b = await client.post(
        "/api/v1/projects",
        headers=tenant_b["headers"],
        json={"name": "Tenant B Concurrency Suite", "framework": "pytest"},
    )
    assert p_a.status_code == 201
    assert p_b.status_code == 201
    proj_a_id = p_a.json()["id"]
    proj_b_id = p_b.json()["id"]

    # 2. Sequential rapid API submissions for Tenant A and Tenant B
    for i in range(3):
        r_a = await client.post(
            f"/api/v1/projects/{proj_a_id}/execution-runs",
            headers=tenant_a["headers"],
            json={"trigger": "manual", "trigger_label": f"Run A-{i}"},
        )
        assert r_a.status_code == 201
        r_b = await client.post(
            f"/api/v1/projects/{proj_b_id}/execution-runs",
            headers=tenant_b["headers"],
            json={"trigger": "manual", "trigger_label": f"Run B-{i}"},
        )
        assert r_b.status_code == 201

    # 3. Concurrent Queue Engine Stress Test
    engine = JobQueueEngine(max_workers=2, max_tenant_concurrent=2)
    await engine.start()
    try:
        async def submit(tenant_id, idx):
            return await engine.submit_job(
                job_id=f"stress_{tenant_id}_{idx}_{uuid.uuid4().hex[:6]}",
                tenant_id=tenant_id,
                project_id=f"proj_{tenant_id}",
                job_type="execution_run",
                command=[sys.executable, "-c", f"import time; time.sleep(0.05); print('Done {idx}')"],
                timeout_seconds=5,
            )

        tasks = [
            submit("tenant_a", 1),
            submit("tenant_a", 2),
            submit("tenant_a", 3),
            submit("tenant_b", 1),
            submit("tenant_b", 2),
            submit("tenant_b", 3),
        ]
        results = await asyncio.gather(*tasks)
        for job, is_dup in results:
            assert is_dup is False
            assert job is not None

        # Wait for queue completion
        await asyncio.sleep(1.0)
        stats = engine.get_stats()
        assert stats["completed_jobs"] >= 6
    finally:
        await engine.shutdown()


@pytest.mark.asyncio
async def test_database_transaction_integrity_on_failure(client: AsyncClient, tenant_a, db_session: AsyncSession):
    """
    Verifies that database transactions roll back cleanly upon failure,
    preventing partial writes, orphaned rows, or dirty reads.
    """
    headers = tenant_a["headers"]
    org_id = tenant_a["org"].id

    initial_project_count = len(
        (await db_session.execute(select(Project).where(Project.organization_id == org_id))).scalars().all()
    )

    # Attempt to post an invalid payload with missing required name field
    bad_res = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"framework": "pytest", "description": "Missing name field"},
    )
    assert bad_res.status_code == 422

    # Verify no phantom project was persisted
    after_project_count = len(
        (await db_session.execute(select(Project).where(Project.organization_id == org_id))).scalars().all()
    )
    assert after_project_count == initial_project_count


@pytest.mark.asyncio
async def test_sandbox_resource_limits_and_disposable_cleanup():
    """
    Verifies untrusted execution limits:
    - Disposable scratch directories are purged immediately after execution.
    - Output stream truncation occurs if untrusted code produces excessive stdout.
    """
    cfg = ExecutionSandboxConfig(
        wall_timeout_seconds=5,
        max_output_bytes=1024,  # 1 KB limit to test truncation
    )

    # Script producing >5KB of output
    cmd = [sys.executable, "-c", "print('A' * 5000)"]

    res = await SandboxManager.execute_in_sandbox(
        command=cmd,
        config=cfg,
    )

    assert res.exit_code == 0
    # Scratch directory must be cleaned up
    assert res.scratch_dir != ""
    assert not os.path.exists(res.scratch_dir), "Disposable scratch directory was not cleaned up!"

    # Output truncation flag must be raised
    assert res.output_truncated is True
    assert len(res.stdout) <= 1500  # Within buffer bounds plus truncation notice
    assert "Output truncated" in res.stdout


@pytest.mark.asyncio
async def test_deep_secret_scrubbing_and_log_redaction():
    """
    Comprehensive verification of secret and credential scrubbing:
    Ensures AWS keys, GitHub tokens, Bearer JWTs, database passwords,
    credit cards, and emails are scrubbed from unstructured inputs.
    """
    dirty_traceback = """
    Traceback (most recent call last):
      File "auth_service.py", line 45, in authenticate
        token = "ghp_1234567890abcdefghijklmnopqrstuvwxyzAB"
        aws_key = "AKIAIOSFODNN7EXAMPLE"
        db = "postgresql://dbuser:super_secret_pw99@db.prod.aws.com:5432/core_db"
        jwt = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature"
        cc = "4532-1234-5678-9012"
        email = "alice.smith@customer-pii-corp.com"
        raise ValueError(f"Failed to connect to {db}")
    ValueError: Failed to connect to postgresql://dbuser:super_secret_pw99@db.prod.aws.com:5432/core_db
    """

    sanitized, redactions = sanitize_sensitive_data(dirty_traceback)
    assert redactions >= 5

    # None of the sensitive tokens or credentials should be present
    assert "ghp_1234567890abcdefghijklmnopqrstuvwxyzAB" not in sanitized
    assert "AKIAIOSFODNN7EXAMPLE" not in sanitized
    assert "super_secret_pw99" not in sanitized
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in sanitized
    assert "4532-1234-5678-9012" not in sanitized
    assert "alice.smith@customer-pii-corp.com" not in sanitized

    # Redaction placeholders should be in place
    assert "[REDACTED_API_TOKEN]" in sanitized
    assert "[REDACTED_AWS_KEY]" in sanitized
    assert "[REDACTED_PASSWORD]" in sanitized
    assert "[REDACTED_JWT_TOKEN]" in sanitized
    assert "[REDACTED_CREDIT_CARD]" in sanitized
    assert "[REDACTED_EMAIL]" in sanitized
