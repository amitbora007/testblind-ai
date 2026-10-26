import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedModel


class IntegrationSetting(TimestampedModel):
    __tablename__ = "integration_settings"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    config: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(TimestampedModel):
    __tablename__ = "audit_events"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
