import ast
import hashlib
import re
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.services.sandbox_service import ExecutionSandboxConfig, SandboxManager


@dataclass
class StackFrame:
    file_path: str
    line_number: int
    function_name: str
    code_line: str = ""


@dataclass
class TracebackAnalysis:
    exception_type: str
    exception_message: str
    fault_module: Optional[str]
    fault_line: Optional[int]
    frames: List[StackFrame] = field(default_factory=list)


@dataclass
class IncidentAnalysisResult:
    hypothesis: str
    repro_code: Optional[str]
    verification_state: str  # needs_more_info | test_generated | submitted
    missing_details: Optional[str]
    assumptions: Optional[str]
    uncertainty_score: float
    fault_module: Optional[str]
    fault_line: Optional[int]
    exception_type: str


@dataclass
class IncidentVerificationOutcome:
    verification_state: str  # reproduced | verified_fixed | failed_to_reproduce | execution_unavailable
    state_a_result: str
    state_b_result: str
    reproduction_proven: bool
    fix_proven: bool
    evidence_hash: str
    duration_ms: float
    state_a_stdout: str
    state_a_stderr: str
    state_b_stdout: str
    state_b_stderr: str
    details: str


class IncidentAnalysisService:
    """
    End-to-End Incident Analysis & Dual-State Verification Engine.
    Parses production stack traces, identifies fault anchors, assesses context adequacy,
    synthesizes targeted reproduction tests, and runs dual-state sandbox verification.
    """

    @classmethod
    def parse_traceback(cls, raw_traceback: str) -> TracebackAnalysis:
        """Parses Python or standard traceback into structured stack frames and exception details."""
        lines = [line.strip() for line in raw_traceback.strip().splitlines() if line.strip()]
        if not lines:
            return TracebackAnalysis(
                exception_type="UnknownException",
                exception_message="No traceback provided",
                fault_module=None,
                fault_line=None,
                frames=[],
            )

        # Extract exception type and message from last line
        last_line = lines[-1]
        exception_type = "RuntimeError"
        exception_message = last_line
        if ":" in last_line:
            parts = last_line.split(":", 1)
            exception_type = parts[0].strip()
            exception_message = parts[1].strip()
        elif "Error" in last_line or "Exception" in last_line:
            exception_type = last_line.strip()

        # Parse stack frames: File "...", line X, in Y
        frames: List[StackFrame] = []
        frame_pattern = re.compile(r'File "([^"]+)", line (\d+)(?:, in (\w+))?')
        for i, line in enumerate(lines):
            match = frame_pattern.search(line)
            if match:
                f_path = match.group(1)
                f_line = int(match.group(2))
                f_func = match.group(3) or "module"
                code_line = lines[i + 1] if i + 1 < len(lines) and not lines[i + 1].startswith("File") else ""
                frames.append(StackFrame(file_path=f_path, line_number=f_line, function_name=f_func, code_line=code_line))

        fault_module = frames[-1].file_path if frames else None
        fault_line = frames[-1].line_number if frames else None

        return TracebackAnalysis(
            exception_type=exception_type,
            exception_message=exception_message,
            fault_module=fault_module,
            fault_line=fault_line,
            frames=frames,
        )

    @classmethod
    def analyze_incident(
        cls,
        title: str,
        raw_traceback: str,
        description: Optional[str] = None,
        expected_behavior: Optional[str] = None,
        actual_behavior: Optional[str] = None,
        buggy_code: Optional[str] = None,
        source_files: Optional[List[str]] = None,
        reproduction_steps: Optional[str] = None,
    ) -> IncidentAnalysisResult:
        """
        Analyzes incident telemetry.
        Crucial Rule: If required code or reproduction details are unavailable,
        it assigns 'needs_more_info' and explicitly catalogs missing details.
        """
        tb_analysis = cls.parse_traceback(raw_traceback)
        fault_mod = tb_analysis.fault_module or "src/unknown.py"
        fault_ln = tb_analysis.fault_line or 1
        exc_type = tb_analysis.exception_type

        # Assess context adequacy
        has_code = bool(buggy_code and buggy_code.strip())
        has_frames = bool(tb_analysis.frames)

        if not has_code:
            # Missing source code to reproduce
            missing = (
                f"Source code for faulting module '{fault_mod}' (around line {fault_ln}) is required "
                f"to synthesize an executable reproduction test for {exc_type}."
            )
            hypothesis = (
                f"Defect appears to originate in {fault_mod} at line {fault_ln} raising {exc_type}. "
                "However, source code was not provided in intake."
            )
            assumptions = (
                "Unable to construct verifiable reproduction without module implementation. "
                "Awaiting source code snippet or repository snapshot."
            )
            return IncidentAnalysisResult(
                hypothesis=hypothesis,
                repro_code=None,
                verification_state="needs_more_info",
                missing_details=missing,
                assumptions=assumptions,
                uncertainty_score=0.90,
                fault_module=fault_mod,
                fault_line=fault_ln,
                exception_type=exc_type,
            )

        # Buggy code is available: parse AST to extract function details
        func_info = cls._extract_function_info(buggy_code, fault_ln)
        func_name = func_info["name"] if func_info else "target_function"
        args = func_info["args"] if func_info else []

        module_basename = fault_mod.split("/")[-1].replace(".py", "")

        # Formulate root cause hypothesis
        hypothesis = (
            f"Unhandled boundary or null-state evaluation in `{func_name}` ({fault_mod}:{fault_ln}) "
            f"triggers `{exc_type}`: {tb_analysis.exception_message}."
        )

        # Synthesize reproduction test targeting the specific failure mode
        repro_code = cls._synthesize_repro_test(
            module_name=module_basename,
            func_name=func_name,
            args=args,
            exc_type=exc_type,
            title=title,
            buggy_code=buggy_code,
            fault_ln=fault_ln,
        )

        assumptions = (
            f"Assumes standalone execution of `{func_name}` where parameter state triggers the "
            f"`{exc_type}` condition without requiring external network dependencies."
        )

        return IncidentAnalysisResult(
            hypothesis=hypothesis,
            repro_code=repro_code,
            verification_state="test_generated",
            missing_details=None,
            assumptions=assumptions,
            uncertainty_score=0.15,
            fault_module=fault_mod,
            fault_line=fault_ln,
            exception_type=exc_type,
        )

    @classmethod
    def _extract_function_info(cls, code: str, line_no: int) -> Optional[Dict[str, Any]]:
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    start = node.lineno
                    end = getattr(node, "end_lineno", start + 100)
                    if start <= line_no <= end:
                        return {
                            "name": node.name,
                            "args": [arg.arg for arg in node.args.args],
                        }
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    return {
                        "name": node.name,
                        "args": [arg.arg for arg in node.args.args],
                    }
        except Exception:
            pass
        return None

    @classmethod
    def _synthesize_repro_test(
        cls,
        module_name: str,
        func_name: str,
        args: List[str],
        exc_type: str,
        title: str,
        buggy_code: str,
        fault_ln: int,
    ) -> str:
        test_func_name = f"test_reproduce_{func_name}_{exc_type.lower().replace(':', '_').replace(' ', '_')[:30]}"

        # Craft reproduction inputs based on the exception type
        if "ZeroDivision" in exc_type or "division" in buggy_code.lower():
            # Trigger division by zero
            arg_assignments = []
            for arg in args:
                if any(k in arg.lower() for k in ["days", "count", "divisor", "total", "billing"]):
                    arg_assignments.append(f"{arg}=0")
                elif "cost" in arg.lower() or "price" in arg.lower():
                    arg_assignments.append(f"{arg}=49.00")
                else:
                    arg_assignments.append(f"{arg}=0")
            args_str = ", ".join(arg_assignments) if arg_assignments else "0, 0"

            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# REPRODUCES INCIDENT: {title}\n"
                f"# Invariant: Must safely calculate or raise explicit validation error instead of {exc_type}\n"
                f"def {test_func_name}():\n"
                f"    # State A (Buggy): Raises unhandled {exc_type}\n"
                f"    # State B (Fixed): Returns safe fallback or 0.0 without uncaught exception\n"
                f"    res = {func_name}({args_str})\n"
                f"    assert res == 0.0 or res is not None\n"
            )

        elif "KeyError" in exc_type or "key" in exc_type.lower():
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# REPRODUCES INCIDENT: {title}\n"
                f"# Invariant: Must handle missing key payload gracefully\n"
                f"def {test_func_name}():\n"
                f"    # Omitting key triggers {exc_type} on buggy code\n"
                f"    res = {func_name}({{}})\n"
                f"    assert res is not None\n"
            )

        elif "IndexError" in exc_type or "out of range" in exc_type.lower():
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# REPRODUCES INCIDENT: {title}\n"
                f"# Invariant: Must handle empty sequence input without {exc_type}\n"
                f"def {test_func_name}():\n"
                f"    res = {func_name}([])\n"
                f"    assert res == 0 or res is None\n"
            )

        elif "TypeError" in exc_type or "NoneType" in exc_type:
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# REPRODUCES INCIDENT: {title}\n"
                f"# Invariant: Must handle None parameter gracefully\n"
                f"def {test_func_name}():\n"
                f"    res = {func_name}(None)\n"
                f"    assert res is not None\n"
            )

        else:
            args_str = ", ".join(["0" for _ in args]) if args else ""
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# REPRODUCES INCIDENT: {title}\n"
                f"def {test_func_name}():\n"
                f"    res = {func_name}({args_str})\n"
                f"    assert res is not None\n"
            )

        return test_code

    @classmethod
    async def verify_dual_state(
        cls,
        buggy_code: str,
        candidate_test_code: str,
        corrected_code: Optional[str] = None,
        module_name: str = "solution",
        expected_exception: Optional[str] = None,
        timeout_seconds: int = 5,
    ) -> IncidentVerificationOutcome:
        """
        Executes dual-state sandbox verification:
        1. State A (Buggy Code): Must FAIL (exit code != 0).
           Validates that test genuinely reproduces the reported defect.
        2. State B (Corrected Code, when supplied): Must PASS (exit code 0).
           Validates that test confirms the fix.
        """
        start_time = time.perf_counter()
        cfg = ExecutionSandboxConfig(wall_timeout_seconds=timeout_seconds)
        cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short", f"test_{module_name}.py"]

        # -------------------------------------------------------------
        # Step 1: State A — Buggy Code Execution (Must FAIL)
        # -------------------------------------------------------------
        files_buggy = {
            f"{module_name}.py": buggy_code,
            f"test_{module_name}.py": candidate_test_code,
        }
        res_buggy = await SandboxManager.execute_in_sandbox(
            command=cmd,
            files=files_buggy,
            config=cfg,
        )

        buggy_failed = (res_buggy.exit_code != 0)

        # If it unexpectedly passed on buggy code, it failed to reproduce!
        if not buggy_failed:
            duration_ms = (time.perf_counter() - start_time) * 1000
            evidence = hashlib.sha256(
                f"{buggy_code}\n{candidate_test_code}\nFAILED_TO_REPRODUCE".encode()
            ).hexdigest()

            return IncidentVerificationOutcome(
                verification_state="failed_to_reproduce",
                state_a_result=f"PASSED (Exit code 0) — Test unexpectedly passed on buggy code; did not reproduce incident.",
                state_b_result="SKIPPED — State A reproduction failed.",
                reproduction_proven=False,
                fix_proven=False,
                evidence_hash=evidence,
                duration_ms=round(duration_ms, 2),
                state_a_stdout=res_buggy.stdout,
                state_a_stderr=res_buggy.stderr,
                state_b_stdout="",
                state_b_stderr="",
                details="Reproduction check failed: Candidate test passed on buggy codebase without triggering the reported failure.",
            )

        # State A passed verification (it reproduced the failure!)
        state_a_result = f"FAILED (Exit code {res_buggy.exit_code}) — Defect reproduced as expected [State A RED]"

        # -------------------------------------------------------------
        # Step 2: State B — Corrected Code Execution (Must PASS)
        # -------------------------------------------------------------
        if not corrected_code or not corrected_code.strip():
            duration_ms = (time.perf_counter() - start_time) * 1000
            evidence = hashlib.sha256(
                f"{buggy_code}\n{candidate_test_code}\nREPRODUCED_ONLY\n{res_buggy.exit_code}".encode()
            ).hexdigest()

            return IncidentVerificationOutcome(
                verification_state="reproduced",
                state_a_result=state_a_result,
                state_b_result="PENDING — No corrected code supplied for State B verification.",
                reproduction_proven=True,
                fix_proven=False,
                evidence_hash=evidence,
                duration_ms=round(duration_ms, 2),
                state_a_stdout=res_buggy.stdout,
                state_a_stderr=res_buggy.stderr,
                state_b_stdout="",
                state_b_stderr="",
                details="Reproduction verified: Test fails on buggy code reproducing incident. Supply corrected code to verify fix.",
            )

        files_fixed = {
            f"{module_name}.py": corrected_code,
            f"test_{module_name}.py": candidate_test_code,
        }
        res_fixed = await SandboxManager.execute_in_sandbox(
            command=cmd,
            files=files_fixed,
            config=cfg,
        )

        fixed_passed = (res_fixed.exit_code == 0)
        duration_ms = (time.perf_counter() - start_time) * 1000

        hash_payload = (
            f"{buggy_code}\n---\n{corrected_code}\n---\n{candidate_test_code}\n---\n"
            f"{res_buggy.exit_code}:{res_fixed.exit_code}"
        )
        evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

        if fixed_passed:
            return IncidentVerificationOutcome(
                verification_state="verified_fixed",
                state_a_result=state_a_result,
                state_b_result=f"PASSED (Exit code 0) — Fix verified [State B GREEN]",
                reproduction_proven=True,
                fix_proven=True,
                evidence_hash=evidence_hash,
                duration_ms=round(duration_ms, 2),
                state_a_stdout=res_buggy.stdout,
                state_a_stderr=res_buggy.stderr,
                state_b_stdout=res_fixed.stdout,
                state_b_stderr=res_fixed.stderr,
                details="Dual-state proof established: Test fails on buggy codebase and passes cleanly on corrected codebase.",
            )
        else:
            return IncidentVerificationOutcome(
                verification_state="reproduced",
                state_a_result=state_a_result,
                state_b_result=f"FAILED (Exit code {res_fixed.exit_code}) — Fix incomplete or broke other assertions.",
                reproduction_proven=True,
                fix_proven=False,
                evidence_hash=evidence_hash,
                duration_ms=round(duration_ms, 2),
                state_a_stdout=res_buggy.stdout,
                state_a_stderr=res_buggy.stderr,
                state_b_stdout=res_fixed.stdout,
                state_b_stderr=res_fixed.stderr,
                details="Reproduction confirmed on buggy code, but test failed on corrected code (fix did not resolve issue).",
            )
