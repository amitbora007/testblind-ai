import asyncio
import os
import re
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
    def discover_source_and_test_files(cls, workspace_dir: str, language: str = "auto") -> Dict[str, Any]:
        """
        Discovers source and test files across Python (.py) and JavaScript / TypeScript / React (.js, .jsx, .ts, .tsx).
        Automatically infers primary codebase language when language is 'auto'.
        """
        source_files: List[str] = []
        test_files: List[str] = []
        workspace_path = Path(workspace_dir)

        py_files: List[str] = []
        py_tests: List[str] = []
        js_files: List[str] = []
        js_tests: List[str] = []

        for root, dirs, files in os.walk(workspace_dir):
            dirs[:] = [d for d in dirs if d not in cls.EXCLUDED_DIRS]

            for file in files:
                full_path = Path(root) / file
                rel_path = str(full_path.relative_to(workspace_path))
                ext = full_path.suffix.lower()

                if ext == ".py":
                    if file.startswith("test_") or file.endswith("_test.py") or "tests/" in rel_path or "test/" in rel_path:
                        py_tests.append(rel_path)
                    else:
                        py_files.append(rel_path)
                elif ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
                    if ext == ".ts" and file.endswith(".d.ts"):
                        continue
                    if any(file.endswith(sfx) for sfx in (".test.ts", ".test.tsx", ".test.js", ".test.jsx", ".spec.ts", ".spec.tsx", ".spec.js", ".spec.jsx")) or "__tests__/" in rel_path or "tests/" in rel_path or "test/" in rel_path:
                        js_tests.append(rel_path)
                    elif not any(file.startswith(cfg) for cfg in ("vite.config", "vitest.config", "jest.config", "tailwind.config", "next.config", "postcss.config", "eslint")):
                        js_files.append(rel_path)

        lang_lower = (language or "auto").lower().strip()
        has_package_json = (workspace_path / "package.json").exists()

        if lang_lower in ("typescript", "javascript", "react", "ts", "js"):
            detected_lang = "typescript" if (lang_lower in ("typescript", "react", "ts") or any(f.endswith((".ts", ".tsx")) for f in (js_files + js_tests))) else "javascript"
            source_files = js_files
            test_files = js_tests
        elif lang_lower == "python":
            detected_lang = "python"
            source_files = py_files
            test_files = py_tests
        else:
            total_jsts = len(js_files) + len(js_tests)
            total_py = len(py_files) + len(py_tests)

            if total_jsts > total_py or (total_jsts > 0 and has_package_json):
                detected_lang = "typescript" if any(f.endswith((".ts", ".tsx")) for f in (js_files + js_tests)) else "javascript"
                source_files = js_files
                test_files = js_tests
            else:
                detected_lang = "python"
                source_files = py_files
                test_files = py_tests

        return {
            "language": detected_lang,
            "source_files": sorted(source_files),
            "test_files": sorted(test_files),
        }

    @classmethod
    def discover_python_files(cls, workspace_dir: str) -> Dict[str, List[str]]:
        res = cls.discover_source_and_test_files(workspace_dir, "python")
        return {
            "source_files": res["source_files"],
            "test_files": res["test_files"],
        }

    @classmethod
    async def run_baseline_tests(
        cls,
        workspace_dir: str,
        test_cmd: Optional[List[str]] = None,
        timeout_seconds: int = 30,
        language: str = "auto",
    ) -> BaselineTestResult:
        if test_cmd:
            cmd = test_cmd
        else:
            files_meta = cls.discover_source_and_test_files(workspace_dir, language=language)
            lang = files_meta["language"]
            if lang == "python":
                cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"]
            else:
                pkg_json = Path(workspace_dir) / "package.json"
                if (Path(workspace_dir) / "vitest.config.ts").exists() or (Path(workspace_dir) / "vitest.config.js").exists():
                    cmd = ["npx", "vitest", "run"]
                elif pkg_json.exists():
                    cmd = ["npm", "test", "--", "--runInBand"]
                else:
                    cmd = ["node", "--test"]

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
        language: str = "auto",
    ) -> Tuple[str, Optional[str]]:
        target_file = Path(workspace_dir) / file_rel_path
        if not target_file.exists():
            return "invalid", None

        original_content = target_file.read_text(encoding="utf-8")
        if not test_cmd:
            is_jsts = file_rel_path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")) or language in ("typescript", "javascript", "react")
            if is_jsts:
                pkg_json = Path(workspace_dir) / "package.json"
                if (Path(workspace_dir) / "vitest.config.ts").exists() or (Path(workspace_dir) / "vitest.config.js").exists():
                    cmd = ["npx", "vitest", "run"]
                elif pkg_json.exists():
                    cmd = ["npm", "test", "--", "--runInBand"]
                else:
                    cmd = ["node", "--test"]
            else:
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
        language: str = "auto",
    ) -> ScanExecutionSummary:
        start_time = time.perf_counter()

        files_meta = cls.discover_source_and_test_files(workspace_dir, language=language)
        primary_lang = files_meta["language"]
        source_files = files_meta["source_files"]

        baseline = await cls.run_baseline_tests(workspace_dir, test_cmd=test_cmd, language=primary_lang)
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
                language=primary_lang,
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
                language=primary_lang,
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

        # Pytest formats
        m_pass = re.search(r"(\d+)\s+passed", stdout)
        if m_pass:
            passed = int(m_pass.group(1))

        m_fail = re.search(r"(\d+)\s+failed", stdout)
        if m_fail:
            failed = int(m_fail.group(1))

        # Vitest / Jest formats (e.g. Tests: 2 passed, 1 failed, 3 total)
        m_v_pass = re.search(r"(\d+)\s+passed", stdout)
        m_v_fail = re.search(r"(\d+)\s+failed", stdout)
        if not m_pass and m_v_pass:
            passed = int(m_v_pass.group(1))
        if not m_fail and m_v_fail:
            failed = int(m_v_fail.group(1))

        total = passed + failed
        return total, passed, failed

    @classmethod
    def _extract_killing_test_name(cls, stdout: str) -> Optional[str]:
        for line in stdout.splitlines():
            # Pytest format
            if line.startswith("FAILED ") or " FAILED" in line:
                parts = line.strip().split()
                for p in parts:
                    if "::" in p:
                        return p.split("::")[-1]
                    elif "test_" in p:
                        return p
            # Vitest / Jest format (e.g. FAIL src/test.ts > testName, or ✕ test name)
            if "FAIL " in line or "✕ " in line or "× " in line:
                cleaned = line.replace("FAIL", "").replace("✕", "").replace("×", "").strip()
                if ">" in cleaned:
                    return cleaned.split(">")[-1].strip()
                return cleaned.split()[-1] if cleaned else "assertion_failure"
        return "assertion_failure"
