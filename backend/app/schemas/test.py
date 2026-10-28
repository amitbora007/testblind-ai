import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class TestCaseCreate(BaseModel):
    name: str
    file_path: str
    function_name: str
    framework: str = "pytest"
    code: str
    repository_name: Optional[str] = None
    branch: Optional[str] = "main"
    commit_sha: Optional[str] = None
    test_type: Optional[str] = "mutation_killer"
    source_incident_id: Optional[uuid.UUID] = None
    source_mutation_id: Optional[uuid.UUID] = None
    review_status: Optional[str] = "approved"
    verification_status: Optional[str] = "verified"
    evidence_hash: Optional[str] = None
    evidence_details: Optional[Dict[str, Any]] = None
    gap_resolved: Optional[bool] = True
    gap_details: Optional[str] = None


class TestCaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    file_path: str
    function_name: str
    framework: str
    code: str
    status: str
    mutation_kill_count: int
    is_flaky: bool
    last_run_at: Optional[datetime] = None
    repository_name: Optional[str] = None
    branch: Optional[str] = "main"
    commit_sha: Optional[str] = None
    test_type: str = "mutation_killer"
    source_incident_id: Optional[uuid.UUID] = None
    source_mutation_id: Optional[uuid.UUID] = None
    review_status: str = "approved"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    verification_status: str = "verified"
    evidence_hash: Optional[str] = None
    evidence_details: Dict[str, Any] = {}
    execution_history: List[Dict[str, Any]] = []
    code_hash: Optional[str] = None
    gap_resolved: bool = True
    gap_details: Optional[str] = None
    created_at: datetime


class TestCaseReviewRequest(BaseModel):
    review_status: str  # approved | rejected | pending_review
    reviewed_by: Optional[str] = None


class TestCaseRunResponse(BaseModel):
    test_case_id: uuid.UUID
    exit_code: int
    status: str
    stdout: str
    stderr: str
    duration_ms: float
    evidence_hash: str


class TestCaseDuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    duplicate_test_case_id: Optional[uuid.UUID] = None
    code_hash: str
    message: str


class TestCaseGroupedResponse(BaseModel):
    grouped_by: str
    groups: Dict[str, List[TestCaseRead]]


class TestScenarioCreate(BaseModel):
    name: str
    requirement_code: str
    description: Optional[str] = None
    steps: List[Dict[str, Any]] = []
    timeout_seconds: int = 60


class TestScenarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    requirement_code: str
    description: Optional[str] = None
    steps: List[Dict[str, Any]]
    status: str
    timeout_seconds: int
    created_at: datetime


class AutoGenerateTestsRequest(BaseModel):
    create_test_cases: bool = True
    create_scenarios: bool = True
    force: bool = False


class AutoGenerateTestsResponse(BaseModel):
    project_id: uuid.UUID
    test_cases_created: int
    scenarios_created: int
    message: str
    test_cases: List[TestCaseRead]
    scenarios: List[TestScenarioRead]

