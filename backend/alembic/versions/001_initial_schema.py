"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-26 12:26:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('billing_plan', sa.String(length=50), server_default='enterprise_trial', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_organizations_id', 'organizations', ['id'])
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)

    # 2. Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_superuser', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # 3. User Memberships
    op.create_table(
        'user_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=50), server_default='engineer', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
    )
    op.create_index('ix_user_memberships_id', 'user_memberships', ['id'])
    op.create_index('ix_user_memberships_user_id', 'user_memberships', ['user_id'])
    op.create_index('ix_user_memberships_organization_id', 'user_memberships', ['organization_id'])

    # 4. Projects
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('framework', sa.String(length=50), server_default='pytest', nullable=False),
        sa.Column('default_branch', sa.String(length=100), server_default='main', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('organization_id', 'slug', name='uq_org_project_slug'),
    )
    op.create_index('ix_projects_id', 'projects', ['id'])
    op.create_index('ix_projects_organization_id', 'projects', ['organization_id'])
    op.create_index('ix_projects_slug', 'projects', ['slug'])

    # 5. Repositories
    op.create_table(
        'repositories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('repo_type', sa.String(length=50), server_default='github', nullable=False),
        sa.Column('repo_url', sa.String(length=500), nullable=True),
        sa.Column('default_branch', sa.String(length=100), server_default='main', nullable=False),
        sa.Column('webhook_secret', sa.String(length=255), nullable=True),
        sa.Column('zip_artifact_path', sa.String(length=500), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_repositories_id', 'repositories', ['id'])
    op.create_index('ix_repositories_project_id', 'repositories', ['project_id'])
    op.create_index('ix_repositories_organization_id', 'repositories', ['organization_id'])

    # 6. Scan Jobs
    op.create_table(
        'scan_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='pending', nullable=False),
        sa.Column('trigger', sa.String(length=50), server_default='manual', nullable=False),
        sa.Column('branch', sa.String(length=100), server_default='main', nullable=False),
        sa.Column('commit_hash', sa.String(length=64), nullable=True),
        sa.Column('total_mutants', sa.Integer(), server_default='0', nullable=False),
        sa.Column('killed_mutants', sa.Integer(), server_default='0', nullable=False),
        sa.Column('surviving_mutants', sa.Integer(), server_default='0', nullable=False),
        sa.Column('mutation_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('duration_seconds', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_scan_jobs_id', 'scan_jobs', ['id'])
    op.create_index('ix_scan_jobs_project_id', 'scan_jobs', ['project_id'])
    op.create_index('ix_scan_jobs_organization_id', 'scan_jobs', ['organization_id'])
    op.create_index('ix_scan_jobs_status', 'scan_jobs', ['status'])

    # 7. Findings
    op.create_table(
        'findings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scan_job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scan_jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('finding_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='high', nullable=False),
        sa.Column('target_file', sa.String(length=500), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=True),
        sa.Column('details', sa.Text(), nullable=False),
        sa.Column('suggested_fix', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_findings_id', 'findings', ['id'])
    op.create_index('ix_findings_scan_job_id', 'findings', ['scan_job_id'])
    op.create_index('ix_findings_project_id', 'findings', ['project_id'])
    op.create_index('ix_findings_organization_id', 'findings', ['organization_id'])

    # 8. Mutations
    op.create_table(
        'mutations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scan_job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scan_jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('operator', sa.String(length=20), nullable=False),
        sa.Column('original_code', sa.Text(), nullable=False),
        sa.Column('mutated_code', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='survived', nullable=False),
        sa.Column('killing_test_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_mutations_id', 'mutations', ['id'])
    op.create_index('ix_mutations_scan_job_id', 'mutations', ['scan_job_id'])
    op.create_index('ix_mutations_project_id', 'mutations', ['project_id'])
    op.create_index('ix_mutations_organization_id', 'mutations', ['organization_id'])
    op.create_index('ix_mutations_operator', 'mutations', ['operator'])
    op.create_index('ix_mutations_status', 'mutations', ['status'])

    # 9. Test Cases
    op.create_table(
        'test_cases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('function_name', sa.String(length=255), nullable=False),
        sa.Column('framework', sa.String(length=50), server_default='pytest', nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='verified', nullable=False),
        sa.Column('mutation_kill_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_flaky', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_test_cases_id', 'test_cases', ['id'])
    op.create_index('ix_test_cases_project_id', 'test_cases', ['project_id'])
    op.create_index('ix_test_cases_organization_id', 'test_cases', ['organization_id'])
    op.create_index('ix_test_cases_status', 'test_cases', ['status'])

    # 10. Test Scenarios
    op.create_table(
        'test_scenarios',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('requirement_code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('steps', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='passed', nullable=False),
        sa.Column('timeout_seconds', sa.Integer(), server_default='60', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_test_scenarios_id', 'test_scenarios', ['id'])
    op.create_index('ix_test_scenarios_project_id', 'test_scenarios', ['project_id'])
    op.create_index('ix_test_scenarios_organization_id', 'test_scenarios', ['organization_id'])
    op.create_index('ix_test_scenarios_requirement_code', 'test_scenarios', ['requirement_code'])

    # 11. Execution Runs
    op.create_table(
        'execution_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trigger', sa.String(length=50), server_default='manual', nullable=False),
        sa.Column('trigger_label', sa.String(length=255), nullable=True),
        sa.Column('branch', sa.String(length=100), server_default='main', nullable=False),
        sa.Column('commit_hash', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='running', nullable=False),
        sa.Column('duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('tests_passed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('tests_failed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tests', sa.Integer(), server_default='0', nullable=False),
        sa.Column('stdout_log', sa.Text(), nullable=True),
        sa.Column('stderr_log', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_execution_runs_id', 'execution_runs', ['id'])
    op.create_index('ix_execution_runs_project_id', 'execution_runs', ['project_id'])
    op.create_index('ix_execution_runs_organization_id', 'execution_runs', ['organization_id'])
    op.create_index('ix_execution_runs_status', 'execution_runs', ['status'])

    # 12. Run Steps
    op.create_table(
        'run_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('execution_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('execution_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_name', sa.String(length=255), nullable=False),
        sa.Column('step_order', sa.Integer(), server_default='1', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='passed', nullable=False),
        sa.Column('duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('log_output', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_run_steps_id', 'run_steps', ['id'])
    op.create_index('ix_run_steps_execution_run_id', 'run_steps', ['execution_run_id'])
    op.create_index('ix_run_steps_organization_id', 'run_steps', ['organization_id'])

    # 13. Incidents
    op.create_table(
        'incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=10), server_default='P1', nullable=False),
        sa.Column('raw_traceback', sa.Text(), nullable=False),
        sa.Column('fault_module', sa.String(length=500), nullable=True),
        sa.Column('fault_line', sa.Integer(), nullable=True),
        sa.Column('hypothesis', sa.Text(), nullable=True),
        sa.Column('repro_code', sa.Text(), nullable=True),
        sa.Column('verification_state', sa.String(length=50), server_default='unverified', nullable=False),
        sa.Column('fixed_commit_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_incidents_id', 'incidents', ['id'])
    op.create_index('ix_incidents_project_id', 'incidents', ['project_id'])
    op.create_index('ix_incidents_organization_id', 'incidents', ['organization_id'])
    op.create_index('ix_incidents_severity', 'incidents', ['severity'])
    op.create_index('ix_incidents_verification_state', 'incidents', ['verification_state'])

    # 14. Integration Settings
    op.create_table(
        'integration_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('config', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_integration_settings_id', 'integration_settings', ['id'])
    op.create_index('ix_integration_settings_organization_id', 'integration_settings', ['organization_id'])
    op.create_index('ix_integration_settings_provider', 'integration_settings', ['provider'])

    # 15. Audit Events
    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', sa.String(length=100), nullable=True),
        sa.Column('details', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_audit_events_id', 'audit_events', ['id'])
    op.create_index('ix_audit_events_organization_id', 'audit_events', ['organization_id'])
    op.create_index('ix_audit_events_user_id', 'audit_events', ['user_id'])
    op.create_index('ix_audit_events_action', 'audit_events', ['action'])


def downgrade() -> None:
    op.drop_table('audit_events')
    op.drop_table('integration_settings')
    op.drop_table('incidents')
    op.drop_table('run_steps')
    op.drop_table('execution_runs')
    op.drop_table('test_scenarios')
    op.drop_table('test_cases')
    op.drop_table('mutations')
    op.drop_table('findings')
    op.drop_table('scan_jobs')
    op.drop_table('repositories')
    op.drop_table('projects')
    op.drop_table('user_memberships')
    op.drop_table('users')
    op.drop_table('organizations')
