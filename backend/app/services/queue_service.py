import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set, Tuple

from app.core.config import settings
from app.services.sandbox_service import ExecutionResult, ExecutionSandboxConfig, SandboxManager

logger = logging.getLogger("testblind.queue")


class JobStatus:
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PASSED = "passed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


@dataclass
class JobRecord:
    job_id: str
    tenant_id: str
    project_id: str
    job_type: str  # "execution_run" or "scan_job"
    command: List[str]
    cwd: Optional[str] = None
    files: Optional[Dict[str, str]] = None
    status: str = JobStatus.QUEUED
    idempotency_key: Optional[str] = None
    timeout_seconds: int = 30
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 2
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    duration_ms: float = 0.0
    error_message: Optional[str] = None
    execution_hash: Optional[str] = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    result: Optional[ExecutionResult] = None
    on_complete_callback: Optional[Callable[[Any], Coroutine[Any, Any, None]]] = None


class JobQueueEngine:
    """
    Queue-backed async background processing engine supporting bounded concurrency,
    job cancellation, timeouts, retries, idempotency, per-tenant quotas, and health monitoring.
    """

    def __init__(
        self,
        max_workers: int = settings.MAX_CONCURRENT_WORKERS,
        max_tenant_concurrent: int = settings.MAX_TENANT_CONCURRENT_RUNS,
    ):
        self.max_workers = max_workers
        self.max_tenant_concurrent = max_tenant_concurrent
        self._jobs: Dict[str, JobRecord] = {}
        self._idempotency_index: Dict[str, str] = {}
        self._tenant_running_jobs: Dict[str, Set[str]] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._workers: List[asyncio.Task] = []
        self._is_running = False
        self._start_time = time.time()
        self._processed_count = 0
        self._failed_count = 0
        self._cancelled_count = 0

    async def start(self):
        """Starts the background worker pool."""
        if self._is_running:
            return
        self._is_running = True
        self._start_time = time.time()
        for i in range(self.max_workers):
            task = asyncio.create_task(self._worker_loop(worker_id=i))
            self._workers.append(task)
        logger.info(f"WorkerPool started with {self.max_workers} worker tasks.")

    async def shutdown(self, timeout: float = 5.0):
        """Gracefully terminates workers and cancels in-flight jobs."""
        self._is_running = False
        for task in self._workers:
            task.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("WorkerPool stopped.")

    async def submit_job(
        self,
        job_id: str,
        tenant_id: str,
        project_id: str,
        job_type: str,
        command: List[str],
        cwd: Optional[str] = None,
        files: Optional[Dict[str, str]] = None,
        idempotency_key: Optional[str] = None,
        timeout_seconds: int = 30,
        max_retries: int = 2,
        on_complete_callback: Optional[Callable[[JobRecord], Coroutine[Any, Any, None]]] = None,
    ) -> Tuple[JobRecord, bool]:
        """
        Submits a job to the execution queue.
        Returns (job_record, is_duplicate).
        """
        # 1. Idempotency Check
        if idempotency_key:
            existing_id = self._idempotency_index.get(idempotency_key)
            if existing_id and existing_id in self._jobs:
                existing_job = self._jobs[existing_id]
                # If still pending or running, return duplicate existing job
                if existing_job.status in (JobStatus.QUEUED, JobStatus.RUNNING):
                    return existing_job, True

        # 2. Check per-tenant active concurrency
        active_tenant_jobs = self._tenant_running_jobs.get(tenant_id, set())
        if len(active_tenant_jobs) >= self.max_tenant_concurrent:
            # Still enqueue, but record warning in logs
            logger.warning(
                f"Tenant {tenant_id} reached concurrent limit ({len(active_tenant_jobs)}/{self.max_tenant_concurrent}). Job {job_id} queued."
            )

        job = JobRecord(
            job_id=job_id,
            tenant_id=tenant_id,
            project_id=project_id,
            job_type=job_type,
            command=command,
            cwd=cwd,
            files=files,
            status=JobStatus.QUEUED,
            idempotency_key=idempotency_key,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            on_complete_callback=on_complete_callback,
        )

        self._jobs[job_id] = job
        if idempotency_key:
            self._idempotency_index[idempotency_key] = job_id

        await self._queue.put(job_id)
        return job, False

    def get_job(self, job_id: str, tenant_id: str) -> Optional[JobRecord]:
        """Retrieves job status with tenant isolation enforcement."""
        job = self._jobs.get(job_id)
        if not job or job.tenant_id != tenant_id:
            return None
        return job

    def cancel_job(self, job_id: str, tenant_id: str) -> bool:
        """Cancels a queued or running job. Terminates execution process tree."""
        job = self._jobs.get(job_id)
        if not job or job.tenant_id != tenant_id:
            return False

        if job.status in (JobStatus.COMPLETED, JobStatus.PASSED, JobStatus.FAILED, JobStatus.CANCELLED):
            return False

        job.cancel_event.set()
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        job.stderr += "\n[Job cancelled by user request]"
        self._cancelled_count += 1

        # Free tenant running slot
        if tenant_id in self._tenant_running_jobs and job_id in self._tenant_running_jobs[tenant_id]:
            self._tenant_running_jobs[tenant_id].remove(job_id)

        return True

    def get_stats(self) -> Dict[str, Any]:
        """Returns queue monitoring statistics."""
        queued = sum(1 for j in self._jobs.values() if j.status == JobStatus.QUEUED)
        running = sum(1 for j in self._jobs.values() if j.status == JobStatus.RUNNING)
        completed = sum(1 for j in self._jobs.values() if j.status in (JobStatus.COMPLETED, JobStatus.PASSED))
        failed = sum(1 for j in self._jobs.values() if j.status == JobStatus.FAILED)
        timed_out = sum(1 for j in self._jobs.values() if j.status == JobStatus.TIMED_OUT)
        cancelled = sum(1 for j in self._jobs.values() if j.status == JobStatus.CANCELLED)

        tenant_counts = {
            t_id: len(jobs) for t_id, jobs in self._tenant_running_jobs.items() if len(jobs) > 0
        }

        return {
            "total_jobs": len(self._jobs),
            "queued_jobs": queued,
            "running_jobs": running,
            "completed_jobs": completed,
            "failed_jobs": failed,
            "timed_out_jobs": timed_out,
            "cancelled_jobs": cancelled,
            "worker_capacity": self.max_workers,
            "active_workers": running,
            "tenant_active_counts": tenant_counts,
            "uptime_seconds": round(time.time() - self._start_time, 2),
        }

    def get_health(self) -> Dict[str, Any]:
        """Health check for workers."""
        alive_workers = sum(1 for w in self._workers if not w.done())
        return {
            "status": "healthy" if alive_workers > 0 or not self._is_running else "degraded",
            "configured_workers": self.max_workers,
            "alive_workers": alive_workers,
            "processed_jobs": self._processed_count,
            "failed_jobs": self._failed_count,
            "cancelled_jobs": self._cancelled_count,
            "is_running": self._is_running,
        }

    async def _worker_loop(self, worker_id: int):
        """Background consumer pulling jobs from queue."""
        while self._is_running:
            try:
                job_id = await self._queue.get()
            except asyncio.CancelledError:
                break

            job = self._jobs.get(job_id)
            if not job or job.status == JobStatus.CANCELLED:
                self._queue.task_done()
                continue

            # Wait if tenant active quota is full
            while True:
                active = self._tenant_running_jobs.setdefault(job.tenant_id, set())
                if len(active) < self.max_tenant_concurrent:
                    active.add(job_id)
                    break
                await asyncio.sleep(0.1)
                if job.status == JobStatus.CANCELLED or not self._is_running:
                    break

            if job.status == JobStatus.CANCELLED or not self._is_running:
                self._queue.task_done()
                continue

            # Execute job with retry policy
            await self._execute_job(job)
            self._queue.task_done()

    async def _execute_job(self, job: JobRecord):
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)

        config = ExecutionSandboxConfig(
            wall_timeout_seconds=job.timeout_seconds,
            cpu_timeout_seconds=min(job.timeout_seconds, 30),
            memory_limit_mb=settings.EXECUTION_MAX_MEMORY_MB,
            max_output_bytes=settings.EXECUTION_MAX_OUTPUT_BYTES,
        )

        try:
            result = await SandboxManager.execute_in_sandbox(
                command=job.command,
                cwd=job.cwd,
                files=job.files,
                config=config,
                cancel_event=job.cancel_event,
            )

            job.result = result
            job.exit_code = result.exit_code
            job.stdout = result.stdout
            job.stderr = result.stderr
            job.duration_ms = result.duration_ms
            job.execution_hash = result.execution_hash

            if result.cancelled:
                job.status = JobStatus.CANCELLED
                self._cancelled_count += 1
            elif result.timed_out:
                job.status = JobStatus.TIMED_OUT
                job.error_message = f"Execution timed out after {job.timeout_seconds}s"
                self._failed_count += 1
            elif result.exit_code == 0:
                job.status = JobStatus.PASSED if job.job_type == "execution_run" else JobStatus.COMPLETED
                self._processed_count += 1
            else:
                # Check retry policy for transient errors (e.g. exit code 1 or system error)
                if job.retry_count < job.max_retries and "timeout" not in (result.stderr or "").lower():
                    job.retry_count += 1
                    backoff = 0.2 * (2 ** (job.retry_count - 1))
                    logger.info(f"Job {job.job_id} failed with exit {result.exit_code}. Retrying ({job.retry_count}/{job.max_retries}) in {backoff}s...")
                    await asyncio.sleep(backoff)
                    await self._queue.put(job.job_id)
                    return
                else:
                    job.status = JobStatus.FAILED
                    job.error_message = f"Process exited with non-zero code {result.exit_code}"
                    self._failed_count += 1

        except Exception as exc:
            logger.error(f"Unexpected error executing job {job.job_id}: {exc}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = str(exc)
            self._failed_count += 1
        finally:
            job.completed_at = datetime.now(timezone.utc)
            # Release tenant concurrency slot
            if job.tenant_id in self._tenant_running_jobs and job.job_id in self._tenant_running_jobs[job.tenant_id]:
                self._tenant_running_jobs[job.tenant_id].remove(job.job_id)

            # Invoke completion callback if provided (e.g. for database persistence)
            if job.on_complete_callback:
                try:
                    await job.on_complete_callback(job)
                except Exception as cb_err:
                    logger.error(f"Error in job completion callback for {job.job_id}: {cb_err}")


# Global singleton queue engine instance
queue_engine = JobQueueEngine()
