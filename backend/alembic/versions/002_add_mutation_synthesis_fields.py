"""add mutation synthesis fields

Revision ID: 002_mutation_synthesis
Revises: 001_initial_schema
Create Date: 2026-10-26 14:26:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_mutation_synthesis"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mutations", sa.Column("synthesized_test_code", sa.Text(), nullable=True))
    op.add_column("mutations", sa.Column("verification_status", sa.String(length=50), nullable=True))
    op.add_column("mutations", sa.Column("evidence_hash", sa.String(length=64), nullable=True))
    op.add_column("mutations", sa.Column("explanation", sa.Text(), nullable=True))
    op.add_column("mutations", sa.Column("missing_boundary", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("mutations", "missing_boundary")
    op.drop_column("mutations", "explanation")
    op.drop_column("mutations", "evidence_hash")
    op.drop_column("mutations", "verification_status")
    op.drop_column("mutations", "synthesized_test_code")
