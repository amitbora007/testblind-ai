import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class ScanJob(TimestampedModel):
    __tablename__ = "scan_jobs"

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
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True, nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    commit_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    total_mutants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    killed_mutants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    surviving_mutants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mutation_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="scan_jobs")
    findings: Mapped[List["Finding"]] = relationship(
        "Finding",
        back_populates="scan_job",
        cascade="all, delete-orphan",
    )
    mutations: Mapped[List["Mutation"]] = relationship(
        "Mutation",
        back_populates="scan_job",
        cascade="all, delete-orphan",
    )


class Finding(TimestampedModel):
    __tablename__ = "findings"

    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
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
    finding_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="high", nullable=False)
    target_file: Mapped[str] = mapped_column(String(500), nullable=False)
    line_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_fix: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    scan_job: Mapped["ScanJob"] = relationship("ScanJob", back_populates="findings")


class Mutation(TimestampedModel):
    __tablename__ = "mutations"

    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
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
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    operator: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    original_code: Mapped[str] = mapped_column(Text, nullable=False)
    mutated_code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="survived", index=True, nullable=False)
    killing_test_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    scan_job: Mapped["ScanJob"] = relationship("ScanJob", back_populates="mutations")
