"""add unified regression protection fields

Revision ID: 004_unified_regression
Revises: 003_incident_workflow
Create Date: 2026-10-26 15:15:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004_unified_regression"
down_revision: Union[str, None] = "003_incident_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions to test_cases
    op.add_column("test_cases", sa.Column("repository_name", sa.String(length=255), nullable=True))
    op.add_column("test_cases", sa.Column("branch", sa.String(length=100), server_default="main", nullable=True))
    op.add_column("test_cases", sa.Column("commit_sha", sa.String(length=64), nullable=True))
    op.add_column("test_cases", sa.Column("test_type", sa.String(length=50), server_default="mutation_killer", nullable=False))
    op.add_column("test_cases", sa.Column("source_incident_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("test_cases", sa.Column("source_mutation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("test_cases", sa.Column("review_status", sa.String(length=50), server_default="approved", nullable=False))
    op.add_column("test_cases", sa.Column("reviewed_by", sa.String(length=255), nullable=True))
    op.add_column("test_cases", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("test_cases", sa.Column("verification_status", sa.String(length=50), server_default="verified", nullable=False))
    op.add_column("test_cases", sa.Column("evidence_hash", sa.String(length=64), nullable=True))
    op.add_column("test_cases", sa.Column("evidence_details", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False))
    op.add_column("test_cases", sa.Column("execution_history", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False))
    op.add_column("test_cases", sa.Column("code_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_test_cases_code_hash"), "test_cases", ["code_hash"], unique=False)
    op.add_column("test_cases", sa.Column("gap_resolved", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("test_cases", sa.Column("gap_details", sa.Text(), nullable=True))

    op.create_foreign_key(
        "fk_test_cases_source_incident_id",
        "test_cases",
        "incidents",
        ["source_incident_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_test_cases_source_mutation_id",
        "test_cases",
        "mutations",
        ["source_mutation_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Extensions to execution_runs
    op.add_column("execution_runs", sa.Column("tests_skipped", sa.Integer(), server_default="0", nullable=False))
    op.add_column("execution_runs", sa.Column("tests_blocked", sa.Integer(), server_default="0", nullable=False))
    op.add_column("execution_runs", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("execution_runs", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("execution_runs", sa.Column("error_details", sa.Text(), nullable=True))
    op.add_column("execution_runs", sa.Column("associated_test_ids", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False))
    op.add_column("execution_runs", sa.Column("associated_finding_ids", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False))


def downgrade() -> None:
    # Revert execution_runs
    op.drop_column("execution_runs", "associated_finding_ids")
    op.drop_column("execution_runs", "associated_test_ids")
    op.drop_column("execution_runs", "error_details")
    op.drop_column("execution_runs", "completed_at")
    op.drop_column("execution_runs", "started_at")
    op.drop_column("execution_runs", "tests_blocked")
    op.drop_column("execution_runs", "tests_skipped")

    # Revert test_cases
    op.drop_constraint("fk_test_cases_source_mutation_id", "test_cases", type_="foreignkey")
    op.drop_constraint("fk_test_cases_source_incident_id", "test_cases", type_="foreignkey")
    op.drop_index(op.f("ix_test_cases_code_hash"), table_name="test_cases")
    op.drop_column("test_cases", "gap_details")
    op.drop_column("test_cases", "gap_resolved")
    op.drop_column("test_cases", "code_hash")
    op.drop_column("test_cases", "execution_history")
    op.drop_column("test_cases", "evidence_details")
    op.drop_column("test_cases", "evidence_hash")
    op.drop_column("test_cases", "verification_status")
    op.drop_column("test_cases", "reviewed_at")
    op.drop_column("test_cases", "reviewed_by")
    op.drop_column("test_cases", "review_status")
    op.drop_column("test_cases", "source_mutation_id")
    op.drop_column("test_cases", "source_incident_id")
    op.drop_column("test_cases", "test_type")
    op.drop_column("test_cases", "commit_sha")
    op.drop_column("test_cases", "branch")
    op.drop_column("test_cases", "repository_name")
