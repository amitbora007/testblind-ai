"""add idempotency_key and test_cases composite index

Revision ID: 005_idempotency_and_index
Revises: 004_unified_regression
Create Date: 2026-11-05 16:33:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_idempotency_and_index"
down_revision: Union[str, None] = "004_unified_regression"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add idempotency_key to scan_jobs
    op.add_column("scan_jobs", sa.Column("idempotency_key", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_scan_jobs_idempotency_key"), "scan_jobs", ["idempotency_key"], unique=False)

    # 2. Add composite index on test_cases (project_id, organization_id, created_at)
    op.create_index(
        "ix_test_cases_project_org_created",
        "test_cases",
        ["project_id", "organization_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_test_cases_project_org_created", table_name="test_cases")
    op.drop_index(op.f("ix_scan_jobs_idempotency_key"), table_name="scan_jobs")
    op.drop_column("scan_jobs", "idempotency_key")
