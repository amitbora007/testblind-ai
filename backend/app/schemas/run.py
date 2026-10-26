import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ExecutionRunCreate(BaseModel):
    trigger: str = "manual"
    trigger_label: Optional[str] = None
    branch: str = "main"
    commit_hash: Optional[str] = None


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
    total_tests: int
    created_at: datetime


class RunLogsRead(BaseModel):
    id: uuid.UUID
    status: str
    stdout_log: Optional[str] = None
    stderr_log: Optional[str] = None
