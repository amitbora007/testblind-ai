import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    framework: str = "pytest"
    default_branch: str = "main"


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    framework: str
    default_branch: str
    created_at: datetime


class RepoConnect(BaseModel):
    repo_type: str = "github"
    repo_url: Optional[str] = None
    default_branch: str = "main"


class RepoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    repo_type: str
    repo_url: Optional[str] = None
    default_branch: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime
