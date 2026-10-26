import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class IncidentCreate(BaseModel):
    title: str
    severity: str = "P1"
    raw_traceback: str
    fault_module: Optional[str] = None
    fault_line: Optional[int] = None


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    severity: str
    raw_traceback: str
    fault_module: Optional[str] = None
    fault_line: Optional[int] = None
    hypothesis: Optional[str] = None
    repro_code: Optional[str] = None
    verification_state: str
    fixed_commit_hash: Optional[str] = None
    created_at: datetime


class IncidentVerifyRequest(BaseModel):
    buggy_commit: Optional[str] = "commit_pre_fix"
    fixed_commit: Optional[str] = "commit_post_fix"


class IncidentVerifyResponse(BaseModel):
    incident_id: uuid.UUID
    verification_state: str
    state_a_result: str
    state_b_result: str
    reproduction_proven: bool
    details: str
