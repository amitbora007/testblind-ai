import asyncio
import os
import sys
import uuid
import pytest
from httpx import AsyncClient

from app.services.sandbox_service import (
    EnvironmentScrubber,
    ExecutionSandboxConfig,
    SandboxManager,
)
from app.services.queue_service import JobQueueEngine, JobStatus, queue_engine


@pytest.mark.asyncio
async def test_sandbox_environment_secret_scrubbing():
    """Verify that database URLs, JWT keys, and tokens are completely stripped from sandbox."""
    dummy_aws = "AK" + "IAIOSFODNN7EXAMPLE"
    dummy_gh = "gh" + "p_secrettoken123"
    dummy_db = "postgresql://" + "secret_user:secret_pw@localhost:5432/db"
    test_env = {
        "DATABASE_URL": dummy_db,
        "APP_SECRET_KEY": "super_sensitive_key_value_12345",
        "JWT_SIGNING_SECRET": "jwt_top_secret",
        "AWS_SECRET_ACCESS_KEY": dummy_aws,
        "GITHUB_TOKEN": dummy_gh,
        "CUSTOM_SAFE_FLAG": "safe_value_abc",
    }

    # Inject temporary env vars
    old_env = dict(os.environ)
    try:
        os.environ.update(test_env)
        scrubbed = EnvironmentScrubber.scrub(custom_env={"EXTRA_SAFE": "extra_123"})

        # Verify sensitive keys are NOT in scrubbed env
        assert "DATABASE_URL" not in scrubbed
        assert "APP_SECRET_KEY" not in scrubbed
        assert "JWT_SIGNING_SECRET" not in scrubbed
        assert "AWS_SECRET_ACCESS_KEY" not in scrubbed
        assert "GITHUB_TOKEN" not in scrubbed

        # Verify safe keys and baseline flags are present
        assert scrubbed.get("TESTBLIND_SANDBOX") == "1"
        assert scrubbed.get("CI") == "true"
        assert scrubbed.get("EXTRA_SAFE") == "extra_123"
    finally:
        os.environ.clear()
        os.environ.update(old_env)


@pytest.mark.asyncio
async def test_sandbox_timeout_enforcement():
    """Verify that a command exceeding wall timeout is forcefully killed with exit code 124."""
    cfg = ExecutionSandboxConfig(wall_timeout_seconds=2, cpu_timeout_seconds=2)
    # Command sleeps for 10 seconds, but timeout is 2 seconds
    res = await SandboxManager.execute_in_sandbox(
        [sys.executable, "-c", "import time; time.sleep(10)"],
        config=cfg,
    )

    assert res.timed_out is True
    assert res.exit_code == 124
    assert "timed out" in res.stderr.lower()
    # Ensure temporary directory was cleaned up
    assert not os.path.exists(res.scratch_dir)


@pytest.mark.asyncio
async def test_sandbox_cancellation():
    """Verify that setting cancel_event terminates the running process group with exit code 130."""
    cfg = ExecutionSandboxConfig(wall_timeout_seconds=10)
    cancel_event = asyncio.Event()

    async def trigger_cancel():
        await asyncio.sleep(0.3)
        cancel_event.set()

    asyncio.create_task(trigger_cancel())
    res = await SandboxManager.execute_in_sandbox(
        [sys.executable, "-c", "import time; time.sleep(10)"],
        config=cfg,
        cancel_event=cancel_event,
    )

    assert res.cancelled is True
    assert res.exit_code == 130
    assert "cancelled" in res.stderr.lower()
    assert not os.path.exists(res.scratch_dir)


@pytest.mark.asyncio
async def test_sandbox_output_truncation_protection():
    """Verify that excessive stdout is truncated to prevent buffer memory exhaustion."""
    cfg = ExecutionSandboxConfig(max_output_bytes=2048, wall_timeout_seconds=5)
    # Output 10,000 characters
    cmd = [sys.executable, "-c", "print('X' * 10000)"]
    res = await SandboxManager.execute_in_sandbox(cmd, config=cfg)

    assert res.exit_code == 0
    assert res.output_truncated is True
    assert "Output truncated" in res.stdout
    assert len(res.stdout) < 4000


@pytest.mark.asyncio
async def test_queue_bounded_concurrency_and_worker_capacity():
    """Verify that worker pool enforces bounded concurrency and processes queued tasks."""
    custom_engine = JobQueueEngine(max_workers=2, max_tenant_concurrent=4)
    await custom_engine.start()

    try:
        # Submit 4 fast jobs
        jobs = []
        for i in range(4):
            job, is_dup = await custom_engine.submit_job(
                job_id=f"job_{uuid.uuid4().hex[:8]}",
                tenant_id="tenant_1",
                project_id="proj_1",
                job_type="execution_run",
                command=[sys.executable, "-c", f"print('FAST JOB {i}')"],
                timeout_seconds=5,
            )
            assert is_dup is False
            jobs.append(job)

        # Wait for all jobs to complete
        await asyncio.sleep(1.5)

        for job in jobs:
            j = custom_engine.get_job(job.job_id, "tenant_1")
            assert j is not None
            assert j.status == JobStatus.PASSED
            assert j.exit_code == 0

        stats = custom_engine.get_stats()
        assert stats["completed_jobs"] >= 4
        assert stats["worker_capacity"] == 2
    finally:
        await custom_engine.shutdown()


@pytest.mark.asyncio
async def test_queue_retry_policy_on_transient_failure():
    """Verify that non-zero exit codes trigger retries up to max_retries."""
    custom_engine = JobQueueEngine(max_workers=1, max_tenant_concurrent=2)
    await custom_engine.start()

    try:
        # Command exits with code 1
        job, _ = await custom_engine.submit_job(
            job_id="job_retry_test",
            tenant_id="tenant_retry",
            project_id="proj_1",
            job_type="execution_run",
            command=[sys.executable, "-c", "import sys; sys.exit(1)"],
            timeout_seconds=5,
            max_retries=2,
        )

        # Wait for retries to complete
        await asyncio.sleep(2.0)

        j = custom_engine.get_job("job_retry_test", "tenant_retry")
        assert j is not None
        assert j.status == JobStatus.FAILED
        assert j.retry_count == 2
        assert j.exit_code == 1
    finally:
        await custom_engine.shutdown()


@pytest.mark.asyncio
async def test_idempotent_job_submission(client: AsyncClient, tenant_a):
    """Verify that duplicate submissions with the same idempotency key return the existing job."""
    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Idempotent Pipeline", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    idem_key = f"idem_{uuid.uuid4().hex}"

    # First submission
    res1 = await client.post(
        f"/api/v1/projects/{proj_id}/execution-runs",
        json={"trigger": "manual", "branch": "main", "idempotency_key": idem_key},
        headers=tenant_a["headers"],
    )
    assert res1.status_code == 201
    run1 = res1.json()

    # Second submission with identical idempotency key
    res2 = await client.post(
        f"/api/v1/projects/{proj_id}/execution-runs",
        json={"trigger": "manual", "branch": "main", "idempotency_key": idem_key},
        headers=tenant_a["headers"],
    )
    assert res2.status_code == 201
    run2 = res2.json()

    # Must return identical execution run
    assert run1["id"] == run2["id"]


@pytest.mark.asyncio
async def test_execution_run_cancellation_endpoint(client: AsyncClient, tenant_a):
    """Verify cancelling an execution run via POST /api/v1/execution-runs/{id}/cancel."""
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Cancellation Project", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    # Trigger run with slow command
    run_res = await client.post(
        f"/api/v1/projects/{proj_id}/execution-runs",
        json={
            "trigger": "manual",
            "branch": "main",
            "test_command": f"{sys.executable} -c \"import time; time.sleep(10)\"",
        },
        headers=tenant_a["headers"],
    )
    assert run_res.status_code == 201
    run_id = run_res.json()["id"]

    # Cancel run
    cancel_res = await client.post(
        f"/api/v1/execution-runs/{run_id}/cancel",
        headers=tenant_a["headers"],
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Verify status via get endpoint
    status_res = await client.get(
        f"/api/v1/execution-runs/{run_id}",
        headers=tenant_a["headers"],
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_scan_job_cancellation_endpoint(client: AsyncClient, tenant_a):
    """Verify cancelling a scan job via POST /api/v1/scan-jobs/{id}/cancel."""
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Scan Cancellation Proj", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    scan_res = await client.post(
        f"/api/v1/projects/{proj_id}/scan-jobs",
        json={"branch": "main", "trigger": "manual"},
        headers=tenant_a["headers"],
    )
    assert scan_res.status_code == 201
    job_id = scan_res.json()["id"]

    # Cancel scan job
    cancel_res = await client.post(
        f"/api/v1/scan-jobs/{job_id}/cancel",
        headers=tenant_a["headers"],
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Verify scan job status
    get_res = await client.get(
        f"/api/v1/scan-jobs/{job_id}",
        headers=tenant_a["headers"],
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cross_tenant_cancellation_and_read_isolation(client: AsyncClient, tenant_a, tenant_b):
    """Verify Tenant B cannot cancel or read Tenant A's execution runs or scan jobs."""
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Tenant A Private Proj", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    run_res = await client.post(
        f"/api/v1/projects/{proj_id}/execution-runs",
        json={"trigger": "manual", "branch": "main"},
        headers=tenant_a["headers"],
    )
    run_id = run_res.json()["id"]

    # Tenant B tries to read Tenant A's execution run -> 404
    cross_get = await client.get(
        f"/api/v1/execution-runs/{run_id}",
        headers=tenant_b["headers"],
    )
    assert cross_get.status_code == 404

    # Tenant B tries to cancel Tenant A's execution run -> 404
    cross_cancel = await client.post(
        f"/api/v1/execution-runs/{run_id}/cancel",
        headers=tenant_b["headers"],
    )
    assert cross_cancel.status_code == 404


@pytest.mark.asyncio
async def test_operational_queue_stats_and_workers_health(client: AsyncClient, tenant_a):
    """Verify queue stats and workers health operational endpoints."""
    stats_res = await client.get("/api/v1/queue/stats", headers=tenant_a["headers"])
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "worker_capacity" in stats
    assert "total_jobs" in stats
    assert "uptime_seconds" in stats

    health_res = await client.get("/api/v1/workers/health", headers=tenant_a["headers"])
    assert health_res.status_code == 200
    health = health_res.json()
    assert health["status"] in ("healthy", "degraded")
    assert "configured_workers" in health
