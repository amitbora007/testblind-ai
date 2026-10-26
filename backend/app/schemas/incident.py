import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: str = Field("P1", pattern="^(P0|P1|P2)$")
    raw_traceback: str = Field(..., min_length=1)
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    reproduction_steps: Optional[str] = None
    commit_hash: Optional[str] = None
    source_files: List[str] = Field(default_factory=list)
    buggy_code: Optional[str] = None
    corrected_code: Optional[str] = None
    fault_module: Optional[str] = None
    fault_line: Optional[int] = None


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(P0|P1|P2)$")
    raw_traceback: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    reproduction_steps: Optional[str] = None
    buggy_code: Optional[str] = None
    corrected_code: Optional[str] = None
    repro_code: Optional[str] = None
    hypothesis: Optional[str] = None
    verification_state: Optional[str] = None


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str] = None
    severity: str
    raw_traceback: str
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    reproduction_steps: Optional[str] = None
    source_files: List[str] = Field(default_factory=list)
    buggy_code: Optional[str] = None
    corrected_code: Optional[str] = None
    fault_module: Optional[str] = None
    fault_line: Optional[int] = None
    hypothesis: Optional[str] = None
    missing_details: Optional[str] = None
    assumptions: Optional[str] = None
    uncertainty_score: Optional[float] = 0.0
    repro_code: Optional[str] = None
    verification_state: str
    fixed_commit_hash: Optional[str] = None
    evidence_hash: Optional[str] = None
    state_a_stdout: Optional[str] = None
    state_a_stderr: Optional[str] = None
    state_b_stdout: Optional[str] = None
    state_b_stderr: Optional[str] = None
    generated_test_id: Optional[uuid.UUID] = None
    created_at: datetime


class IncidentVerifyRequest(BaseModel):
    candidate_test_code: Optional[str] = None
    buggy_code: Optional[str] = None
    corrected_code: Optional[str] = None
    fixed_commit: Optional[str] = None


class IncidentVerifyResponse(BaseModel):
    incident_id: uuid.UUID
    verification_state: str
    state_a_result: str
    state_b_result: str
    reproduction_proven: bool
    fix_proven: bool
    evidence_hash: str
    duration_ms: float
    state_a_stdout: str = ""
    state_a_stderr: str = ""
    state_b_stdout: str = ""
    state_b_stderr: str = ""
    details: str


class IncidentPromoteRequest(BaseModel):
    name: Optional[str] = None
    file_path: Optional[str] = None
    test_code: Optional[str] = None


class IncidentPromoteResponse(BaseModel):
    test_case_id: uuid.UUID
    incident_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    file_path: str
    status: str
    evidence_hash: str
    message: str
