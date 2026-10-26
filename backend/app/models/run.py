import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class ExecutionRun(TimestampedModel):
    __tablename__ = "execution_runs"

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
    trigger: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    trigger_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    commit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="running", index=True, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tests_passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tests_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tests_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tests_blocked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    associated_test_ids: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    associated_finding_ids: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    stdout_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stderr_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="execution_runs")
    steps: Mapped[List["RunStep"]] = relationship(
        "RunStep",
        back_populates="execution_run",
        cascade="all, delete-orphan",
    )


class RunStep(TimestampedModel):
    __tablename__ = "run_steps"

    execution_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("execution_runs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="passed", nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    log_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    execution_run: Mapped["ExecutionRun"] = relationship("ExecutionRun", back_populates="steps")
