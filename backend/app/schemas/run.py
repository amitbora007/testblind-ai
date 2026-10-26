import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ExecutionRunCreate(BaseModel):
    trigger: str = "manual"
    trigger_label: Optional[str] = None
    branch: str = "main"
    commit_hash: Optional[str] = None
    idempotency_key: Optional[str] = None
    timeout_seconds: Optional[int] = 30
    test_command: Optional[str] = None


class ExecutionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    trigger: str
    trigger_label: Optional[str] = None
    branch: str
    commit_hash: Optional[str] = None
    status: str
    duration_ms: int
    tests_passed: int
    tests_failed: int
    tests_skipped: int = 0
    tests_blocked: int = 0
    total_tests: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_details: Optional[str] = None
    associated_test_ids: list[str] = []
    associated_finding_ids: list[str] = []
    stdout_log: Optional[str] = None
    stderr_log: Optional[str] = None
    created_at: datetime


class ExecutionRunListResponse(BaseModel):
    items: list[ExecutionRunRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class RunLogsRead(BaseModel):
    id: uuid.UUID
    status: str
    stdout_log: Optional[str] = None
    stderr_log: Optional[str] = None
