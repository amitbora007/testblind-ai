import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SentryWebhookPayload(BaseModel):
    id: Optional[str] = None
    project: Optional[str] = None
    project_slug: Optional[str] = None
    message: Optional[str] = None
    culprit: Optional[str] = None
    level: Optional[str] = "error"
    traceback: Optional[str] = None
    raw_event: Optional[Dict[str, Any]] = None


class GenericErrorWebhookPayload(BaseModel):
    title: str = Field(..., description="Short summary of the production incident")
    raw_traceback: str = Field(..., description="Full multi-line stack trace")
    severity: str = Field("high", description="Severity: critical, high, medium, low")
    project_name: Optional[str] = None
    source_files: Optional[List[str]] = None
    buggy_code: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None


class GitPatchResponse(BaseModel):
    incident_id: uuid.UUID
    filename: str
    patch_content: str
    pr_title: str
    pr_body: str
    evidence_hash: Optional[str] = None
    verification_state: str
    test_function_name: Optional[str] = None
