import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class IntegrationSettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    provider: str
    config: Dict[str, Any]
    is_enabled: bool
    last_sync_at: Optional[datetime] = None


class IntegrationSettingUpdate(BaseModel):
    config: Dict[str, Any]
    is_enabled: bool = True


class CliTokenResponse(BaseModel):
    token: str
    install_command: str
    expires_in_days: int = 90


class IntegrationTestRequest(BaseModel):
    config: Dict[str, Any] = {}


class IntegrationTestResponse(BaseModel):
    success: bool
    message: str
    provider: str
    latency_ms: int = 120
    details: Dict[str, Any] = {}


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    details: Dict[str, Any]
    ip_address: Optional[str] = None
    created_at: datetime
