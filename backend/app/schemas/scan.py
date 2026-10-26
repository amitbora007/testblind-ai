import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ScanJobCreate(BaseModel):
    branch: str = "main"
    commit_hash: Optional[str] = None
    trigger: str = "manual"
    idempotency_key: Optional[str] = None
    timeout_seconds: Optional[int] = 30


class ScanJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    status: str
    trigger: str
    branch: str
    commit_hash: Optional[str] = None
    total_mutants: int
    killed_mutants: int
    surviving_mutants: int
    mutation_score: float
    duration_seconds: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class MutationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scan_job_id: uuid.UUID
    file_path: str
    line_number: int
    operator: str
    original_code: str
    mutated_code: str
    status: str
    killing_test_name: Optional[str] = None


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scan_job_id: uuid.UUID
    finding_type: str
    severity: str
    target_file: str
    line_number: Optional[int] = None
    details: str
    suggested_fix: Optional[str] = None
