import enum
import uuid
from typing import List
from sqlalchemy import Boolean, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedModel


class RoleEnum(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class Organization(TimestampedModel):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    billing_plan: Mapped[str] = mapped_column(String(50), default="enterprise_trial", nullable=False)

    # Relationships
    memberships: Mapped[List["UserMembership"]] = relationship(
        "UserMembership",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="organization",
        cascade="all, delete-orphan",
    )


class User(TimestampedModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    memberships: Mapped[List["UserMembership"]] = relationship(
        "UserMembership",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserMembership(TimestampedModel):
    __tablename__ = "user_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_user_organization"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role: Mapped[RoleEnum] = mapped_column(
        Enum(RoleEnum, name="role_enum", native_enum=False),
        default=RoleEnum.ENGINEER,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="memberships")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="memberships")
