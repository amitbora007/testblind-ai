import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class ZipUploadResponse(BaseModel):
    repository_id: uuid.UUID
    project_id: uuid.UUID
    repo_type: str = "zip"
    filename: str
    file_size_bytes: int
    detected_language: str
    detected_languages: List[str]
    detected_test_runner: str
    suggested_test_command: str
    total_files: int
    source_files: int
    test_files: int
    config_files: List[str]
    file_manifest: List[str]
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: str = "Archive safely extracted and repository structure verified."


class RepositoryStructureRead(BaseModel):
    repository_id: uuid.UUID
    project_id: uuid.UUID
    repo_type: str
    detected_language: str
    detected_test_runner: str
    suggested_test_command: str
    total_files: int
    source_files: int
    test_files: int
    file_manifest: List[str]
