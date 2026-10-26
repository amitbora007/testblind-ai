import secrets
from datetime import datetime, timezone
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.models.audit import IntegrationSetting
from app.models.user import RoleEnum
from app.schemas.audit import (
    CliTokenResponse,
    IntegrationSettingRead,
    IntegrationSettingUpdate,
)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("", response_model=List[IntegrationSettingRead])
async def list_integrations(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[IntegrationSettingRead]:
    """List all integrations configured for the current tenant organization."""
    query = select(IntegrationSetting).where(
        IntegrationSetting.organization_id == tenant.organization_id
    )
    items = (await db.execute(query)).scalars().all()
    return [IntegrationSettingRead.model_validate(item) for item in items]


@router.put("/{provider}", response_model=IntegrationSettingRead)
async def update_integration(
    provider: str,
    data: IntegrationSettingUpdate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IntegrationSettingRead:
    """Update or create integration settings for a provider (e.g. github, slack, jira). Requires Admin role."""
    query = select(IntegrationSetting).where(
        IntegrationSetting.organization_id == tenant.organization_id,
        IntegrationSetting.provider == provider.lower(),
    )
    setting = (await db.execute(query)).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not setting:
        setting = IntegrationSetting(
            organization_id=tenant.organization_id,
            provider=provider.lower(),
            config=data.config,
            is_enabled=data.is_enabled,
            last_sync_at=now,
        )
        db.add(setting)
    else:
        setting.config = data.config
        setting.is_enabled = data.is_enabled
        setting.last_sync_at = now

    await db.commit()
    await db.refresh(setting)

    return IntegrationSettingRead.model_validate(setting)


@router.post("/cli-token", response_model=CliTokenResponse)
async def generate_cli_token(
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
) -> CliTokenResponse:
    """Generate a high-entropy runner token for the local on-premises testblind-cli agent."""
    token_hex = secrets.token_hex(24)
    token = f"tb_live_{token_hex}"
    cmd = f"curl -fsSL https://get.testblind.ai | sh && testblind auth --token {token}"

    return CliTokenResponse(
        token=token,
        install_command=cmd,
        expires_in_days=90,
    )
