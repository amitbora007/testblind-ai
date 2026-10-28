import ast
import csv
import hashlib
import io
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.incident import Incident
from app.models.project import Project
from app.models.run import ExecutionRun
from app.models.scan import Mutation, ScanJob
from app.models.test import TestCase
from app.services.sandbox_service import ExecutionSandboxConfig, SandboxManager


class RegressionService:
    """
    Unified Regression Protection Service.
    Combines AST mutation testing, incident regressions, test duplicate detection,
    sandbox test verification, reporting, and CI orchestration.
    """

    @staticmethod
    def compute_code_hash(code: str) -> str:
        """
        Computes a normalized SHA-256 hash of test source code.
        Strips whitespace, comments, and empty lines to detect duplicate test logic.
        """
        # Strip comments and blank lines
        clean_lines = []
        for line in code.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            clean_lines.append(stripped)
        normalized = "\n".join(clean_lines)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @staticmethod
    async def check_duplicate(
        db: AsyncSession,
        project_id: uuid.UUID,
        code_hash: str,
        exclude_id: Optional[uuid.UUID] = None,
    ) -> Optional[TestCase]:
        """
        Checks if a test case with the same normalized code hash already exists in the project.
        """
        query = select(TestCase).where(
            TestCase.project_id == project_id,
            TestCase.code_hash == code_hash,
        )
        if exclude_id:
            query = query.where(TestCase.id != exclude_id)

        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def execute_test_case(
        db: AsyncSession,
        test_case: TestCase,
        custom_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes a cataloged test case in an isolated POSIX/Docker sandbox.
        Records execution evidence, logs, and updates execution history.
        """
        code_to_run = custom_code or test_case.code

        # Run in sandbox
        cfg = ExecutionSandboxConfig(wall_timeout_seconds=30)
        if "def test_" in code_to_run or "pytest" in code_to_run or "unittest" in code_to_run:
            cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short", "test_case.py"]
        else:
            cmd = [sys.executable, "test_case.py"]
        files = {"test_case.py": code_to_run}

        sandbox_res = await SandboxManager.execute_in_sandbox(
            command=cmd,
            files=files,
            config=cfg,
        )

        exit_code = sandbox_res.exit_code
        stdout = sandbox_res.stdout
        stderr = sandbox_res.stderr
        duration_ms = sandbox_res.duration_ms

        # Compute immutable evidence hash
        hasher = hashlib.sha256()
        hasher.update(code_to_run.encode("utf-8"))
        hasher.update(stdout.encode("utf-8"))
        hasher.update(str(exit_code).encode("utf-8"))
        evidence_hash = hasher.hexdigest()

        now = datetime.now(timezone.utc)
        status = "verified" if exit_code == 0 else "failed"

        history_entry = {
            "run_id": str(uuid.uuid4()),
            "executed_at": now.isoformat(),
            "exit_code": exit_code,
            "status": status,
            "duration_ms": duration_ms,
            "evidence_hash": evidence_hash,
        }

        # Update test case state
        test_case.last_run_at = now
        test_case.status = status
        test_case.verification_status = status
        test_case.evidence_hash = evidence_hash

        current_history = list(test_case.execution_history or [])
        current_history.append(history_entry)
        test_case.execution_history = current_history

        await db.commit()
        await db.refresh(test_case)

        return {
            "test_case_id": test_case.id,
            "exit_code": exit_code,
            "status": status,
            "stdout": stdout,
            "stderr": stderr,
            "duration_ms": duration_ms,
            "evidence_hash": evidence_hash,
        }

    @staticmethod
    async def aggregate_unified_report(
        db: AsyncSession,
        organization_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Aggregates mutation effectiveness, surviving mutations, test generation stats,
        execution history, and recurring incidents for reporting.
        """
        # 1. Mutation Effectiveness
        mut_query = select(Mutation).where(Mutation.organization_id == organization_id)
        if project_id:
            mut_query = mut_query.join(ScanJob, Mutation.scan_job_id == ScanJob.id).where(
                ScanJob.project_id == project_id
            )
        mutations = (await db.execute(mut_query)).scalars().all()

        total_mutants = len(mutations)
        killed_mutants = sum(1 for m in mutations if m.status == "killed")
        survived_mutants = sum(1 for m in mutations if m.status == "survived")
        timed_out_mutants = sum(1 for m in mutations if m.status == "timeout")
        equivalent_mutants = sum(1 for m in mutations if getattr(m, "is_equivalent", False))
        invalid_mutants = sum(1 for m in mutations if not getattr(m, "is_valid", True))

        effective_total = total_mutants - equivalent_mutants - invalid_mutants
        mutation_score = (
            round((killed_mutants / effective_total) * 100, 2)
            if effective_total > 0
            else 0.0
        )

        # Per operator breakdown
        operators: Dict[str, Dict[str, Any]] = {"ROR": {"total": 0, "killed": 0}, "AOR": {"total": 0, "killed": 0}, "LCR": {"total": 0, "killed": 0}, "BSR": {"total": 0, "killed": 0}}
        for m in mutations:
            op_key = m.operator.upper() if m.operator else "ROR"
            if op_key not in operators:
                operators[op_key] = {"total": 0, "killed": 0}
            operators[op_key]["total"] += 1
            if m.status == "killed":
                operators[op_key]["killed"] += 1

        for k, v in operators.items():
            tot = v["total"]
            kld = v["killed"]
            v["rate"] = round((kld / tot) * 100, 1) if tot > 0 else 0.0

        # Surviving mutants detail
        surviving_list = [
            {
                "id": str(m.id),
                "file_path": m.file_path,
                "line_number": m.line_number,
                "operator": m.operator,
                "original_code": m.original_code,
                "mutated_code": m.mutated_code,
                "missing_boundary": getattr(m, "missing_boundary", None),
            }
            for m in mutations
            if m.status == "survived"
        ][:20]

        # 2. Test Cases & Test Generation
        tc_query = (
            select(TestCase)
            .options(joinedload(TestCase.project))
            .where(TestCase.organization_id == organization_id)
        )
        if project_id:
            tc_query = tc_query.where(TestCase.project_id == project_id)
        test_cases = (await db.execute(tc_query)).scalars().all()

        total_tests = len(test_cases)
        approved_tests = sum(1 for t in test_cases if getattr(t, "review_status", "") == "approved")
        pending_tests = sum(1 for t in test_cases if getattr(t, "review_status", "") == "pending_review")
        rejected_tests = sum(1 for t in test_cases if getattr(t, "review_status", "") == "rejected")
        verified_tests = sum(1 for t in test_cases if t.status == "verified")
        mutation_killers = sum(1 for t in test_cases if getattr(t, "test_type", "") == "mutation_killer")
        incident_regressions = sum(1 for t in test_cases if getattr(t, "test_type", "") == "incident_regression")
        resolved_gaps = sum(1 for t in test_cases if getattr(t, "gap_resolved", True))

        # Group test cases into test suites by file_path
        suites_dict: Dict[str, Dict[str, Any]] = {}
        for tc in test_cases:
            fp = tc.file_path or "tests/test_auto_generated.py"
            proj_name = (
                getattr(tc.project, "name", None)
                if getattr(tc, "project", None)
                else (tc.repository_name or "default-project")
            )
            if fp not in suites_dict:
                suite_id = f"SUITE-{len(suites_dict) + 1:02d}"
                suites_dict[fp] = {
                    "id": suite_id,
                    "name": fp,
                    "project": proj_name,
                    "project_id": str(tc.project_id),
                    "testCount": 0,
                    "mutationKillRate": 0.0,
                    "lineCoverage": 0.0,
                    "branchCoverage": 0.0,
                    "flakinessScore": 0.0,
                    "status": "optimal" if tc.status == "verified" else "warning",
                    "lastRun": tc.last_run_at.isoformat() if tc.last_run_at else "Cataloged (Ready)",
                    "mutantBreakdown": {
                        "ror": {"total": 0, "killed": 0},
                        "aor": {"total": 0, "killed": 0},
                        "lcr": {"total": 0, "killed": 0},
                        "bsr": {"total": 0, "killed": 0},
                    },
                }
            suite = suites_dict[fp]
            suite["testCount"] += 1
            if tc.mutation_kill_count > 0:
                suite["mutantBreakdown"]["ror"]["killed"] += tc.mutation_kill_count
                suite["mutantBreakdown"]["ror"]["total"] += tc.mutation_kill_count
            if tc.is_flaky:
                suite["flakinessScore"] = 5.0
                suite["status"] = "warning"

        for s in suites_dict.values():
            tot_k = sum(m["killed"] for m in s["mutantBreakdown"].values())
            tot_m = sum(m["total"] for m in s["mutantBreakdown"].values())
            if tot_m > 0:
                s["mutationKillRate"] = round((tot_k / tot_m) * 100, 1)

        test_suites_list = list(suites_dict.values())

        # 3. Execution History Runs
        run_query = select(ExecutionRun).where(ExecutionRun.organization_id == organization_id)
        if project_id:
            run_query = run_query.where(ExecutionRun.project_id == project_id)
        runs = (await db.execute(run_query.order_by(ExecutionRun.created_at.desc()).limit(50))).scalars().all()

        total_runs = len(runs)
        passed_runs = sum(1 for r in runs if r.status in ("passed", "success"))
        failed_runs = sum(1 for r in runs if r.status in ("failed", "error"))
        avg_duration_ms = int(sum(r.duration_ms for r in runs) / total_runs) if total_runs > 0 else 0

        # 4. Recurring Incidents
        inc_query = select(Incident).where(Incident.organization_id == organization_id)
        if project_id:
            inc_query = inc_query.where(Incident.project_id == project_id)
        incidents = (await db.execute(inc_query)).scalars().all()

        incident_modules: Dict[str, Dict[str, Any]] = {}
        for inc in incidents:
            mod = getattr(inc, "faulting_module", None) or "general"
            if mod not in incident_modules:
                incident_modules[mod] = {"module": mod, "count": 0, "verified_fixed": 0}
            incident_modules[mod]["count"] += 1
            if getattr(inc, "status", "") in ("verified_fixed", "promoted"):
                incident_modules[mod]["verified_fixed"] += 1

        recurring_list = sorted(list(incident_modules.values()), key=lambda x: x["count"], reverse=True)

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": str(organization_id),
            "project_id": str(project_id) if project_id else None,
            "mutation_effectiveness": {
                "overall_score": mutation_score,
                "total_mutants": total_mutants,
                "killed_mutants": killed_mutants,
                "survived_mutants": survived_mutants,
                "timed_out_mutants": timed_out_mutants,
                "operators": operators,
                "surviving_mutations": surviving_list,
            },
            "test_generation": {
                "total_tests": total_tests,
                "verified_tests": verified_tests,
                "approved_tests": approved_tests,
                "pending_review": pending_tests,
                "rejected_tests": rejected_tests,
                "mutation_killers": mutation_killers,
                "incident_regressions": incident_regressions,
                "resolved_gaps": resolved_gaps,
            },
            "test_suites": test_suites_list,
            "execution_history": {
                "total_runs": total_runs,
                "passed_runs": passed_runs,
                "failed_runs": failed_runs,
                "average_duration_ms": avg_duration_ms,
            },
            "recurring_incidents": recurring_list,
        }

    @staticmethod
    def export_csv(report: Dict[str, Any]) -> str:
        """
        Formats unified report data into CSV format.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["=== TESTBLIND AI UNIFIED REGRESSION PROTECTION REPORT ==="])
        writer.writerow(["Generated At", report.get("generated_at")])
        writer.writerow(["Organization ID", report.get("organization_id")])
        writer.writerow([])

        # Mutation Section
        writer.writerow(["--- MUTATION EFFECTIVENESS ---"])
        mut = report.get("mutation_effectiveness", {})
        writer.writerow(["Overall Mutation Score", f"{mut.get('overall_score')}%"])
        writer.writerow(["Total Mutants", mut.get("total_mutants")])
        writer.writerow(["Killed Mutants", mut.get("killed_mutants")])
        writer.writerow(["Survived Mutants", mut.get("survived_mutants")])
        writer.writerow([])

        writer.writerow(["Operator", "Total", "Killed", "Kill Rate %"])
        for op, data in mut.get("operators", {}).items():
            writer.writerow([op, data.get("total"), data.get("killed"), f"{data.get('rate')}%"])
        writer.writerow([])

        # Test Generation Section
        writer.writerow(["--- TEST LIBRARY & GENERATION ---"])
        tg = report.get("test_generation", {})
        writer.writerow(["Total Test Cases", tg.get("total_tests")])
        writer.writerow(["Verified Tests", tg.get("verified_tests")])
        writer.writerow(["Approved Tests", tg.get("approved_tests")])
        writer.writerow(["Pending Review", tg.get("pending_review")])
        writer.writerow(["Mutation Killers", tg.get("mutation_killers")])
        writer.writerow(["Incident Regressions", tg.get("incident_regressions")])
        writer.writerow(["Resolved Gaps", tg.get("resolved_gaps")])
        # Test Suites Section
        writer.writerow(["--- TEST SUITES AUDIT BREAKDOWN ---"])
        writer.writerow(["Suite Name", "Project", "Tests", "Mutation Kill Rate %", "Status", "Last Run"])
        for s in report.get("test_suites", []):
            writer.writerow([
                s.get("name"),
                s.get("project"),
                s.get("testCount"),
                f"{s.get('mutationKillRate', 0.0)}%",
                s.get("status"),
                s.get("lastRun"),
            ])
        writer.writerow([])

        # Execution History Section
        writer.writerow(["--- EXECUTION RUNS HISTORY ---"])
        eh = report.get("execution_history", {})
        writer.writerow(["Total Runs", eh.get("total_runs")])
        writer.writerow(["Passed Runs", eh.get("passed_runs")])
        writer.writerow(["Failed Runs", eh.get("failed_runs")])
        writer.writerow(["Avg Duration (ms)", eh.get("average_duration_ms")])
        writer.writerow([])

        # Recurring Incidents Section
        writer.writerow(["--- RECURRING INCIDENTS ---"])
        writer.writerow(["Faulting Module", "Occurrence Count", "Verified Fixed"])
        for rec in report.get("recurring_incidents", []):
            writer.writerow([rec.get("module"), rec.get("count"), rec.get("verified_fixed")])

        return output.getvalue()

    @staticmethod
    def get_ci_contract() -> Dict[str, Any]:
        """
        Returns the extensible CI systems integration contract.
        Clearly labels functional, configured, and planned integrations.
        """
        return {
            "version": "1.0.0",
            "auth_schemes": ["Bearer <jwt>", "Header X-TestBlind-Token: <token>"],
            "endpoints": {
                "trigger_run": "POST /api/v1/ci/runs",
                "check_status": "GET /api/v1/ci/runs/{run_id}",
                "workflow_template": "GET /api/v1/ci/workflow-template",
            },
            "integrations": [
                {
                    "name": "GitHub Actions",
                    "status": "functional_and_configured",
                    "auth_method": "X-TestBlind-Token",
                    "description": "Native GitHub Actions step invoking TestBlind API with PR check reports.",
                    "documentation": "Add TESTBLIND_TOKEN as repo secret and use testblind-regression.yml.",
                },
                {
                    "name": "TestBlind Local CLI (testblind-cli)",
                    "status": "functional_and_configured",
                    "auth_method": "Bearer Token / CLI Runner Token",
                    "description": "On-premises terminal CLI executing local AST scans without uploading source code.",
                    "documentation": "Generate runner token via /api/v1/integrations/cli-token.",
                },
                {
                    "name": "GitLab CI",
                    "status": "planned",
                    "auth_method": "CI_JOB_TOKEN / Webhook",
                    "description": "GitLab CI component for pipeline stages.",
                    "documentation": "Planned for post-v1.0 release.",
                },
                {
                    "name": "Jenkins",
                    "status": "planned",
                    "auth_method": "Jenkins Credential Plugin",
                    "description": "Jenkins shared library and post-build test runner plugin.",
                    "documentation": "Planned for enterprise tier.",
                },
                {
                    "name": "CircleCI",
                    "status": "planned",
                    "auth_method": "CircleCI Context Token",
                    "description": "CircleCI Orb for regression protection gating.",
                    "documentation": "Planned for post-v1.0 release.",
                },
            ],
        }

    @staticmethod
    def generate_github_actions_workflow() -> str:
        """
        Generates a functional, ready-to-use GitHub Actions workflow file.
        """
        return """name: TestBlind Unified Regression Protection

on:
  pull_request:
    branches: [main, master, develop]
  push:
    branches: [main]

jobs:
  testblind-regression-guard:
    name: Run TestBlind Regression Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Run TestBlind Regression Check
        env:
          TESTBLIND_API_URL: ${{ secrets.TESTBLIND_API_URL || 'https://api.testblind.ai' }}
          TESTBLIND_TOKEN: ${{ secrets.TESTBLIND_TOKEN }}
        run: |
          echo "Triggering TestBlind CI Regression Run..."
          RESPONSE=$(curl -fsSL -X POST "${TESTBLIND_API_URL}/api/v1/ci/runs" \\
            -H "Content-Type: application/json" \\
            -H "X-TestBlind-Token: ${TESTBLIND_TOKEN}" \\
            -d '{
              "repository_url": "${{ github.server_url }}/${{ github.repository }}",
              "branch": "${{ github.head_ref || github.ref_name }}",
              "commit_sha": "${{ github.sha }}",
              "pr_number": ${{ github.event.pull_request.number || 0 }},
              "trigger_source": "github_actions"
            }')
          
          RUN_ID=$(echo "$RESPONSE" | grep -o '"run_id":"[^"]*' | cut -d'"' -f4)
          echo "TestBlind Run ID: ${RUN_ID}"
          echo "Verification URL: ${TESTBLIND_API_URL}/runs/${RUN_ID}"
"""
