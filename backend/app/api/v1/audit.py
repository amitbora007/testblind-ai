from typing import Annotated, List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, require_role
from app.core.database import get_db
from app.models.audit import AuditEvent
from app.models.user import RoleEnum
from app.schemas.audit import AuditEventRead

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("", response_model=List[AuditEventRead])
async def list_audit_events(
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[AuditEventRead]:
    """List audit events for the current organization. Requires Admin or Owner role."""
    query = (
        select(AuditEvent)
        .where(AuditEvent.organization_id == tenant.organization_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    )
    events = (await db.execute(query)).scalars().all()
    return [AuditEventRead.model_validate(e) for e in events]
