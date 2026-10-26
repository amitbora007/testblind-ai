from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GitHubStatusRead(BaseModel):
    configured: bool = Field(
        ...,
        description="Whether GitHub App credentials (CLIENT_ID/SECRET) are set in environment.",
    )
    connected: bool = Field(
        ...,
        description="Whether the active organization has an authenticated GitHub connection.",
    )
    account: Optional[str] = Field(None, description="Connected GitHub user or organization login.")
    installation_id: Optional[str] = Field(None, description="GitHub App installation identifier.")
    permissions: List[str] = Field(
        default_factory=list,
        description="Granted GitHub App scopes (e.g. ['repo:read', 'pull_requests:write']).",
    )
    setup_instructions: Optional[str] = Field(
        None,
        description="Clear instructions on how to set up GitHub credentials if unconfigured.",
    )


class GitHubConnectRequest(BaseModel):
    code: Optional[str] = Field(None, description="OAuth temporary authorization code.")
    installation_id: Optional[str] = Field(None, description="GitHub App installation ID.")


class GitHubRepoItem(BaseModel):
    id: int
    name: str
    full_name: str
    private: bool
    default_branch: str = "main"
    html_url: str
    description: Optional[str] = None
    permissions: Dict[str, bool] = Field(default_factory=dict)
    updated_at: Optional[str] = None


class GitHubBranchItem(BaseModel):
    name: str
    commit_sha: str
    protected: bool = False


class GitHubCommitItem(BaseModel):
    sha: str
    message: str
    author: str
    date: str


class GitHubLinkRepoRequest(BaseModel):
    repo_url: str = Field(..., description="Full GitHub repository URL (e.g. https://github.com/org/repo)")
    default_branch: str = Field("main", description="Branch to track and run scans against.")
    target_commit: Optional[str] = Field(None, description="Optional target commit SHA.")
