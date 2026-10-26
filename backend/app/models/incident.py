import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(10), default="P1", index=True, nullable=False)
    raw_traceback: Mapped[str] = mapped_column(Text, nullable=False)
    expected_behavior: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actual_behavior: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reproduction_steps: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_files: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    buggy_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    corrected_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fault_module: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fault_line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hypothesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    missing_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assumptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uncertainty_score: Mapped[Optional[float]] = mapped_column(Float, default=0.0, nullable=True)
    repro_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_state: Mapped[str] = mapped_column(
        String(50), default="submitted", index=True, nullable=False
    )
    fixed_commit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    evidence_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    state_a_stdout: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state_a_stderr: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state_b_stdout: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state_b_stderr: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generated_test_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="incidents")
    generated_test: Mapped[Optional["TestCase"]] = relationship("TestCase", foreign_keys=[generated_test_id])
