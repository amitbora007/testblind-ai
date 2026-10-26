import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class Incident(TimestampedModel):
    __tablename__ = "incidents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), default="P1", index=True, nullable=False)
    raw_traceback: Mapped[str] = mapped_column(Text, nullable=False)
    fault_module: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fault_line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hypothesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    repro_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_state: Mapped[str] = mapped_column(
        String(50), default="unverified", index=True, nullable=False
    )
    fixed_commit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="incidents")
