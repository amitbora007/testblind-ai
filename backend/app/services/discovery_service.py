import asyncio
import os
import re
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.services.mutation_engine import ASTMutationEngine, MutantSpec
from app.services.sandbox_service import ExecutionSandboxConfig, SandboxManager


@dataclass
class BaselineTestResult:
    exit_code: int
    passed: bool
    duration_seconds: float
    total_tests: int
    passed_tests: int
    failed_tests: int
    stdout: str
    stderr: str


@dataclass
class ScanExecutionSummary:
    total_mutants: int
    killed_mutants: int
    surviving_mutants: int
    timed_out_mutants: int
    equivalent_mutants: int
    invalid_mutants: int
    mutation_score: float
    baseline_passed: bool
    duration_seconds: float
    mutants: List[MutantSpec] = field(default_factory=list)


class TestDiscoveryService:
    """
    Discovers Python source files and existing test suites,
    runs baseline tests in isolated execution sandboxes,
    and coordinates mutation testing executions.
    """

    EXCLUDED_DIRS = {
        ".git",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        "node_modules",
        ".mypy_cache",
        "dist",
        "build",
    }

    @classmethod
    def discover_python_files(cls, workspace_dir: str) -> Dict[str, List[str]]:
        source_files: List[str] = []
        test_files: List[str] = []

        workspace_path = Path(workspace_dir)
        for root, dirs, files in os.walk(workspace_dir):
            dirs[:] = [d for d in dirs if d not in cls.EXCLUDED_DIRS]

            for file in files:
                if file.endswith(".py"):
                    full_path = Path(root) / file
                    rel_path = str(full_path.relative_to(workspace_path))

                    if (
                        file.startswith("test_")
                        or file.endswith("_test.py")
                        or "tests/" in rel_path
                        or "test/" in rel_path
                    ):
                        test_files.append(rel_path)
                    else:
                        source_files.append(rel_path)

        return {
            "source_files": sorted(source_files),
            "test_files": sorted(test_files),
        }

    @classmethod
    async def run_baseline_tests(
        cls,
        workspace_dir: str,
        test_cmd: Optional[List[str]] = None,
        timeout_seconds: int = 30,
    ) -> BaselineTestResult:
        cmd = test_cmd or [sys.executable, "-m", "pytest", "-v", "--tb=short"]
        cfg = ExecutionSandboxConfig(
            wall_timeout_seconds=timeout_seconds,
            custom_env={"PYTHONPATH": f".:{workspace_dir}", "COLUMNS": "80", "LINES": "24"},
        )

        res = await SandboxManager.execute_in_sandbox(
            command=cmd,
            cwd=workspace_dir,
            config=cfg,
        )
        passed = (res.exit_code == 0)
        total_tests, passed_tests, failed_tests = cls._parse_pytest_counts(res.stdout)

        return BaselineTestResult(
            exit_code=res.exit_code,
            passed=passed,
            duration_seconds=res.duration_ms / 1000.0,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            stdout=res.stdout,
            stderr=res.stderr,
        )

    @classmethod
    async def execute_mutant(
        cls,
        workspace_dir: str,
        file_rel_path: str,
        mutated_source: str,
        test_cmd: Optional[List[str]] = None,
        timeout_seconds: int = 10,
    ) -> Tuple[str, Optional[str]]:
        target_file = Path(workspace_dir) / file_rel_path
        if not target_file.exists():
            return "invalid", None

        original_content = target_file.read_text(encoding="utf-8")
        if not test_cmd:
            from app.services.impact_analysis import TestImpactAnalyzer
            impacted = TestImpactAnalyzer.get_impacted_tests(workspace_dir, file_rel_path)
            if impacted:
                cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"] + impacted
            else:
                cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"]
        else:
            cmd = test_cmd

        cfg = ExecutionSandboxConfig(
            wall_timeout_seconds=timeout_seconds,
            custom_env={"PYTHONPATH": f".:{workspace_dir}", "COLUMNS": "80", "LINES": "24"},
        )

        try:
            target_file.write_text(mutated_source, encoding="utf-8")
            res = await SandboxManager.execute_in_sandbox(
                command=cmd,
                cwd=workspace_dir,
                config=cfg,
            )

            if res.timed_out or res.exit_code == 124:
                return "timeout", None
            elif res.exit_code != 0:
                killing_test = cls._extract_killing_test_name(res.stdout)
                return "killed", killing_test
            else:
                return "survived", None
        finally:
            target_file.write_text(original_content, encoding="utf-8")

    @classmethod
    async def run_mutation_scan_on_workspace(
        cls,
        workspace_dir: str,
        max_mutants: int = 50,
        test_cmd: Optional[List[str]] = None,
    ) -> ScanExecutionSummary:
        start_time = time.perf_counter()

        baseline = await cls.run_baseline_tests(workspace_dir, test_cmd=test_cmd)
        if not baseline.passed:
            duration = round(time.perf_counter() - start_time, 2)
            return ScanExecutionSummary(
                total_mutants=0,
                killed_mutants=0,
                surviving_mutants=0,
                timed_out_mutants=0,
                equivalent_mutants=0,
                invalid_mutants=0,
                mutation_score=0.0,
                baseline_passed=False,
                duration_seconds=duration,
                mutants=[],
            )

        files = cls.discover_python_files(workspace_dir)
        source_files = files["source_files"]

        all_mutants: List[MutantSpec] = []
        for src_file in source_files:
            if len(all_mutants) >= max_mutants:
                break
            full_path = Path(workspace_dir) / src_file
            content = full_path.read_text(encoding="utf-8")
            mutants = ASTMutationEngine.generate_mutants_for_source(
                source_code=content,
                file_path=src_file,
                max_mutants=max_mutants - len(all_mutants),
            )
            all_mutants.extend(mutants)

        killed_count = 0
        survived_count = 0
        timeout_count = 0
        equivalent_count = 0
        invalid_count = 0

        for mutant in all_mutants:
            if mutant.is_equivalent:
                mutant.status = "equivalent"
                equivalent_count += 1
                continue

            if not mutant.is_valid:
                mutant.status = "invalid"
                invalid_count += 1
                continue

            status, killing_test = await cls.execute_mutant(
                workspace_dir=workspace_dir,
                file_rel_path=mutant.file_path,
                mutated_source=mutant.mutated_source,
                test_cmd=test_cmd,
            )
            mutant.status = status
            mutant.killing_test_name = killing_test

            if status == "killed":
                killed_count += 1
            elif status == "survived":
                survived_count += 1
            elif status == "timeout":
                timeout_count += 1
            elif status == "invalid":
                invalid_count += 1

        non_equivalent = len(all_mutants) - equivalent_count - invalid_count
        if non_equivalent > 0:
            mutation_score = round((killed_count / non_equivalent) * 100.0, 1)
        else:
            mutation_score = 0.0

        total_duration = round(time.perf_counter() - start_time, 2)

        return ScanExecutionSummary(
            total_mutants=len(all_mutants),
            killed_mutants=killed_count,
            surviving_mutants=survived_count,
            timed_out_mutants=timeout_count,
            equivalent_mutants=equivalent_count,
            invalid_mutants=invalid_count,
            mutation_score=mutation_score,
            baseline_passed=True,
            duration_seconds=total_duration,
            mutants=all_mutants,
        )

    @classmethod
    def _parse_pytest_counts(cls, stdout: str) -> Tuple[int, int, int]:
        passed = 0
        failed = 0
        total = 0

        m_pass = re.search(r"(\d+)\s+passed", stdout)
        if m_pass:
            passed = int(m_pass.group(1))

        m_fail = re.search(r"(\d+)\s+failed", stdout)
        if m_fail:
            failed = int(m_fail.group(1))

        total = passed + failed
        return total, passed, failed

    @classmethod
    def _extract_killing_test_name(cls, stdout: str) -> Optional[str]:
        for line in stdout.splitlines():
            if line.startswith("FAILED ") or " FAILED" in line:
                parts = line.strip().split()
                for p in parts:
                    if "::" in p:
                        return p.split("::")[-1]
                    elif "test_" in p:
                        return p
        return "assertion_failure"
