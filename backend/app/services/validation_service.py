import hashlib
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from app.services.sandbox_service import ExecutionSandboxConfig, SandboxManager


@dataclass
class ValidationOutcome:
    verification_status: str  # ai_suggestion, generated_unexecuted, verified_passing, mutation_killing, execution_failure
    verified: bool
    baseline_passed: bool
    mutant_killed: bool
    evidence_hash: str
    duration_ms: float
    baseline_stdout: str
    baseline_stderr: str
    mutant_stdout: str
    mutant_stderr: str
    details: str


class DualStateTestValidator:
    """
    Enforces the dual-state verification quality gate for AI-synthesized tests.
    Every test must pass on pristine code (Gate 1) and fail on mutated code (Gate 2)
    before being certified as a verified mutation killer.
    """

    @classmethod
    async def validate_candidate_test(
        cls,
        source_code: str,
        mutated_source: str,
        candidate_test_code: str,
        module_name: str = "solution",
        timeout_seconds: int = 5,
    ) -> ValidationOutcome:
        start_time = time.perf_counter()
        cfg = ExecutionSandboxConfig(wall_timeout_seconds=timeout_seconds)
        cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short", f"test_{module_name}.py"]

        conftest_stub = (
            "import sys, os, builtins, types, asyncio\n"
            "from unittest.mock import MagicMock, AsyncMock\n"
            "from importlib.machinery import ModuleSpec\n"
            "import pytest\n\n"
            "class AutoMock(types.ModuleType):\n"
            "    def __getattr__(self, name):\n"
            "        mock = MagicMock()\n"
            "        mock.__await__ = lambda self: asyncio.sleep(0, result=MagicMock()).__await__()\n"
            "        return mock\n\n"
            "class AutoMockFinder:\n"
            "    @classmethod\n"
            "    def find_spec(cls, fullname, path=None, target=None):\n"
            "        if fullname.startswith('pytest') or fullname.startswith('_pytest') or fullname in sys.builtin_module_names:\n"
            "            return None\n"
            "        try:\n"
            "            import importlib.util\n"
            "            spec = importlib.util.find_spec(fullname)\n"
            "            if spec is not None:\n"
            "                return None\n"
            "        except Exception:\n"
            "            pass\n"
            "        return ModuleSpec(fullname, cls)\n"
            "    @classmethod\n"
            "    def create_module(cls, spec):\n"
            "        return AutoMock(spec.name)\n"
            "    @classmethod\n"
            "    def exec_module(cls, module):\n"
            "        pass\n\n"
            "if not any(getattr(f, '__name__', '') == 'AutoMockFinder' for f in sys.meta_path):\n"
            "    sys.meta_path.append(AutoMockFinder)\n\n"
            "def _safe_get_terminal_size(fallback=(80, 24)):\n"
            "    return os.terminal_size((80, 24))\n"
            "os.get_terminal_size = _safe_get_terminal_size\n\n"
            "def _mock_input(prompt=''):\n"
            "    return '5'\n"
            "builtins.input = _mock_input\n\n"
            "@pytest.fixture\n"
            "def db_session():\n"
            "    s = AsyncMock()\n"
            "    s.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]), first=MagicMock(return_value=None)))))\n"
            "    s.commit = AsyncMock()\n"
            "    s.rollback = AsyncMock()\n"
            "    return s\n"
        )

        # -------------------------------------------------------------
        # Gate 1: Baseline Check on Pristine Code (Must PASS)
        # -------------------------------------------------------------
        files_base = {
            f"{module_name}.py": source_code,
            f"test_{module_name}.py": candidate_test_code,
            "conftest.py": conftest_stub,
        }
        res_base = await SandboxManager.execute_in_sandbox(
            command=cmd,
            files=files_base,
            config=cfg,
        )

        baseline_passed = (res_base.exit_code == 0)
        if not baseline_passed:
            duration_ms = (time.perf_counter() - start_time) * 1000
            evidence = hashlib.sha256(
                f"{source_code}\n{candidate_test_code}\nFAIL_BASE".encode()
            ).hexdigest()

            return ValidationOutcome(
                verification_status="execution_failure",
                verified=False,
                baseline_passed=False,
                mutant_killed=False,
                evidence_hash=evidence,
                duration_ms=round(duration_ms, 2),
                baseline_stdout=res_base.stdout,
                baseline_stderr=res_base.stderr,
                mutant_stdout="",
                mutant_stderr="",
                details="Candidate test failed on pristine baseline code (regression or hallucinated test setup).",
            )

        # -------------------------------------------------------------
        # Gate 2: Mutation Killing Check on Mutated Code (Must FAIL)
        # -------------------------------------------------------------
        files_mutant = {
            f"{module_name}.py": mutated_source,
            f"test_{module_name}.py": candidate_test_code,
            "conftest.py": conftest_stub,
        }
        res_mutant = await SandboxManager.execute_in_sandbox(
            command=cmd,
            files=files_mutant,
            config=cfg,
        )

        mutant_failed = (res_mutant.exit_code != 0)
        duration_ms = (time.perf_counter() - start_time) * 1000

        hash_payload = (
            f"{source_code}\n---\n{mutated_source}\n---\n"
            f"{candidate_test_code}\n---\n{res_base.exit_code}:{res_mutant.exit_code}"
        )
        evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

        if mutant_failed:
            return ValidationOutcome(
                verification_status="mutation_killing",
                verified=True,
                baseline_passed=True,
                mutant_killed=True,
                evidence_hash=evidence_hash,
                duration_ms=round(duration_ms, 2),
                baseline_stdout=res_base.stdout,
                baseline_stderr=res_base.stderr,
                mutant_stdout=res_mutant.stdout,
                mutant_stderr=res_mutant.stderr,
                details="Verified killing test: Passed on pristine baseline and failed on mutated code.",
            )
        else:
            return ValidationOutcome(
                verification_status="verified_passing",
                verified=False,
                baseline_passed=True,
                mutant_killed=False,
                evidence_hash=evidence_hash,
                duration_ms=round(duration_ms, 2),
                baseline_stdout=res_base.stdout,
                baseline_stderr=res_base.stderr,
                mutant_stdout=res_mutant.stdout,
                mutant_stderr=res_mutant.stderr,
                details="Candidate test passed on pristine code but also passed on mutant (failed to kill).",
            )
