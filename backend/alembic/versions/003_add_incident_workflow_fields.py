"""add incident workflow fields

Revision ID: 003_incident_workflow
Revises: 002_mutation_synthesis
Create Date: 2026-10-26 14:53:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_incident_workflow"
down_revision: Union[str, None] = "002_mutation_synthesis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("incidents", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("expected_behavior", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("actual_behavior", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("reproduction_steps", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("source_files", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False))
    op.add_column("incidents", sa.Column("buggy_code", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("corrected_code", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("missing_details", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("assumptions", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("uncertainty_score", sa.Float(), nullable=True))
    op.add_column("incidents", sa.Column("evidence_hash", sa.String(length=64), nullable=True))
    op.add_column("incidents", sa.Column("state_a_stdout", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("state_a_stderr", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("state_b_stdout", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("state_b_stderr", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("generated_test_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_incidents_generated_test_id",
        "incidents",
        "test_cases",
        ["generated_test_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_incidents_generated_test_id", "incidents", type_="foreignkey")
    op.drop_column("incidents", "generated_test_id")
    op.drop_column("incidents", "state_b_stderr")
    op.drop_column("incidents", "state_b_stdout")
    op.drop_column("incidents", "state_a_stderr")
    op.drop_column("incidents", "state_a_stdout")
    op.drop_column("incidents", "evidence_hash")
    op.drop_column("incidents", "uncertainty_score")
    op.drop_column("incidents", "assumptions")
    op.drop_column("incidents", "missing_details")
    op.drop_column("incidents", "corrected_code")
    op.drop_column("incidents", "buggy_code")
    op.drop_column("incidents", "source_files")
    op.drop_column("incidents", "reproduction_steps")
    op.drop_column("incidents", "actual_behavior")
    op.drop_column("incidents", "expected_behavior")
    op.drop_column("incidents", "description")
