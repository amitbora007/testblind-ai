import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class Project(TimestampedModel):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_org_project_slug"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    framework: Mapped[str] = mapped_column(String(50), default="pytest", nullable=False)
    default_branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="projects")
    repositories: Mapped[List["Repository"]] = relationship(
        "Repository",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    scan_jobs: Mapped[List["ScanJob"]] = relationship(
        "ScanJob",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    test_scenarios: Mapped[List["TestScenario"]] = relationship(
        "TestScenario",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    execution_runs: Mapped[List["ExecutionRun"]] = relationship(
        "ExecutionRun",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    incidents: Mapped[List["Incident"]] = relationship(
        "Incident",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class Repository(TimestampedModel):
    __tablename__ = "repositories"

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
    repo_type: Mapped[str] = mapped_column(String(50), default="github", nullable=False)
    repo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    default_branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    zip_artifact_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="repositories")
