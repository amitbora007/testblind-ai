import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class TestCase(TimestampedModel):
    __tablename__ = "test_cases"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    function_name: Mapped[str] = mapped_column(String(255), nullable=False)
    framework: Mapped[str] = mapped_column(String(50), default="pytest", nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="verified", index=True, nullable=False)
    mutation_kill_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_flaky: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_cases")


class TestScenario(TimestampedModel):
    __tablename__ = "test_scenarios"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    requirement_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    steps: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="passed", index=True, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_scenarios")
