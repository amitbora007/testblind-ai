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
    created_at: datetime


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
