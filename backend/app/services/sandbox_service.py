import asyncio
import hashlib
import logging
import os
import re
import resource
import shutil
import signal
import sys
import tempfile
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings

logger = logging.getLogger("testblind.sandbox")

# Disallowed environment keywords that must NEVER be leaked to untrusted workloads
SENSITIVE_ENV_SUBSTRINGS: Set[str] = {
    "SECRET",
    "KEY",
    "TOKEN",
    "PASSWORD",
    "PASSWD",
    "DATABASE",
    "POSTGRES",
    "PG",
    "JWT",
    "AWS",
    "MINIO",
    "GITHUB",
    "AUTH",
    "CREDENTIAL",
    "PRIVATE",
    "CERT",
}

SAFE_BASELINE_ENV_KEYS: Set[str] = {
    "PATH",
    "LANG",
    "LC_ALL",
    "PYTHONPATH",
    "PYTHONHOME",
    "NODE_PATH",
    "HOME",
    "USER",
    "TERM",
    "TMPDIR",
}


@dataclass
class ExecutionSandboxConfig:
    """Configurable resource and security boundaries for untrusted execution."""
    cpu_timeout_seconds: int = 30
    wall_timeout_seconds: int = 45
    memory_limit_mb: int = 512
    max_processes: int = 2048
    max_file_size_bytes: int = 20 * 1024 * 1024  # 20 MB
    max_output_bytes: int = 1024 * 1024  # 1 MB
    allow_network: bool = False
    custom_env: Optional[Dict[str, str]] = None


@dataclass
class ExecutionResult:
    """Standardized output from isolated execution."""
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    timed_out: bool = False
    cancelled: bool = False
    output_truncated: bool = False
    execution_hash: str = ""
    driver_used: str = "hardened_subprocess"
    scratch_dir: str = ""
    artifacts: Dict[str, Any] = field(default_factory=dict)


class EnvironmentScrubber:
    """
    Strips application secrets, database URLs, JWT keys, and cloud credentials
    before passing the environment to an untrusted sandbox execution process.
    """

    @classmethod
    def scrub(cls, custom_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        clean_env: Dict[str, str] = {}

        # 1. Populate only safe baseline keys from the host
        for key, value in os.environ.items():
            upper_key = key.upper()
            # If matches sensitive substring, strictly omit
            if any(sub in upper_key for sub in SENSITIVE_ENV_SUBSTRINGS):
                continue
            if key in SAFE_BASELINE_ENV_KEYS:
                clean_env[key] = value

        # 2. Add secure sandbox overrides
        clean_env["PYTHONUNBUFFERED"] = "1"
        clean_env["PYTHONDONTWRITEBYTECODE"] = "1"
        clean_env["TESTBLIND_SANDBOX"] = "1"
        clean_env["CI"] = "true"

        # 3. Apply explicit, non-sensitive custom variables if provided
        if custom_env:
            for k, v in custom_env.items():
                upper_k = k.upper()
                if not any(sub in upper_k for sub in SENSITIVE_ENV_SUBSTRINGS):
                    clean_env[k] = v

        return clean_env


def _set_posix_resource_limits(config: ExecutionSandboxConfig):
    """
    Executed as preexec_fn inside the child process fork before exec.
    Sets process group and POSIX resource limits (CPU, memory, max processes, file size).
    """
    # 1. Establish new process group for clean subtree termination
    os.setsid()

    # 2. Hard CPU limit (seconds)
    if hasattr(resource, "RLIMIT_CPU"):
        try:
            resource.setrlimit(
                resource.RLIMIT_CPU,
                (config.cpu_timeout_seconds, config.cpu_timeout_seconds + 5),
            )
        except (ValueError, OSError):
            pass

    # 3. Virtual Address Space / Memory limit (bytes)
    if hasattr(resource, "RLIMIT_AS"):
        try:
            mem_bytes = config.memory_limit_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except (ValueError, OSError):
            pass

    # 4. Max processes / threads limit to prevent fork bombs
    # On Linux, RLIMIT_NPROC is per-UID across the entire machine. Only enforce if safe.
    if hasattr(resource, "RLIMIT_NPROC") and config.max_processes > 0:
        try:
            curr_soft, curr_hard = resource.getrlimit(resource.RLIMIT_NPROC)
            safe_limit = max(config.max_processes, 2048)
            if safe_limit < curr_hard:
                resource.setrlimit(resource.RLIMIT_NPROC, (safe_limit, curr_hard))
        except (ValueError, OSError):
            pass

    # 5. Max file size limit to prevent disk exhaustion
    if hasattr(resource, "RLIMIT_FSIZE"):
        try:
            resource.setrlimit(
                resource.RLIMIT_FSIZE,
                (config.max_file_size_bytes, config.max_file_size_bytes),
            )
        except (ValueError, OSError):
            pass


class HardenedSubprocessDriver:
    """
    Executes code in a hardened subprocess environment with POSIX resource limits,
    secret scrubbing, disposable scratch directories, and process group isolation.
    """

    @classmethod
    async def execute(
        cls,
        command: List[str],
        cwd: Optional[str] = None,
        files: Optional[Dict[str, str]] = None,
        config: Optional[ExecutionSandboxConfig] = None,
        cancel_event: Optional[asyncio.Event] = None,
        copy_from_dir: Optional[str] = None,
    ) -> ExecutionResult:
        cfg = config or ExecutionSandboxConfig()
        start_time = time.perf_counter()

        # Create isolated disposable scratch directory
        os.makedirs(settings.SANDBOX_BASE_DIR, exist_ok=True)
        temp_dir = tempfile.mkdtemp(prefix="run_", dir=settings.SANDBOX_BASE_DIR)
        exec_cwd = cwd or temp_dir

        # Copy workspace files if requested for full execution isolation
        if copy_from_dir and os.path.isdir(copy_from_dir):
            shutil.copytree(
                copy_from_dir,
                temp_dir,
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache"),
            )
            exec_cwd = temp_dir

        # Write any required source/test files into the sandbox
        if files:
            for rel_path, content in files.items():
                abs_path = os.path.join(exec_cwd, rel_path)
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                with open(abs_path, "w", encoding="utf-8") as f:
                    f.write(content)

        # Scrub environment variables
        env = EnvironmentScrubber.scrub(cfg.custom_env)
        # Ensure workspace and tests dir are on PYTHONPATH
        tests_dir = os.path.join(exec_cwd, "tests")
        pythonpath_entries = [exec_cwd]
        if os.path.isdir(tests_dir):
            pythonpath_entries.append(tests_dir)
        old_pythonpath = env.get("PYTHONPATH", "")
        if old_pythonpath:
            pythonpath_entries.append(old_pythonpath)
        env["PYTHONPATH"] = ":".join(pythonpath_entries)

        proc: Optional[asyncio.subprocess.Process] = None
        pgid: Optional[int] = None
        timed_out = False
        cancelled = False
        output_truncated = False

        try:
            # Check pre-cancellation
            if cancel_event and cancel_event.is_set():
                return ExecutionResult(
                    exit_code=130,
                    stdout="",
                    stderr="Execution cancelled before start.",
                    duration_ms=0.0,
                    cancelled=True,
                    driver_used="hardened_subprocess",
                    scratch_dir=temp_dir,
                )

            # Spawn subprocess with preexec_fn for process group and resource limits
            proc = await asyncio.create_subprocess_exec(
                *command,
                cwd=exec_cwd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=lambda: _set_posix_resource_limits(cfg),
            )
            pgid = proc.pid

            # Monitor cancellation task alongside execution
            async def wait_process():
                stdout_bytes, stderr_bytes = await proc.communicate()
                return stdout_bytes, stderr_bytes

            async def wait_cancellation():
                if cancel_event:
                    await cancel_event.wait()
                    return True
                await asyncio.Event().wait()
                return False

            process_task = asyncio.create_task(wait_process())
            cancel_task = asyncio.create_task(wait_cancellation())

            done, pending = await asyncio.wait(
                [process_task, cancel_task],
                timeout=float(cfg.wall_timeout_seconds),
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Cancel background cancellation listener if process completed first
            for t in pending:
                t.cancel()

            if not done:
                # Timeout occurred!
                timed_out = True
                cls._kill_process_group(pgid)
                if proc:
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=2.0)
                    except Exception:
                        pass
                stdout_str = ""
                stderr_str = f"Execution timed out: Exceeded {cfg.wall_timeout_seconds}s wall limit."
                exit_code = 124  # Standard timeout exit code
            elif cancel_task in done and cancel_event and cancel_event.is_set():
                # Cancellation requested!
                cancelled = True
                cls._kill_process_group(pgid)
                if proc:
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=2.0)
                    except Exception:
                        pass
                stdout_str = ""
                stderr_str = "Execution cancelled by client."
                exit_code = 130  # Standard SIGINT/cancel exit code
            else:
                stdout_bytes, stderr_bytes = process_task.result()
                # Apply output buffer size capping
                if len(stdout_bytes) > cfg.max_output_bytes:
                    stdout_bytes = stdout_bytes[: cfg.max_output_bytes]
                    output_truncated = True
                if len(stderr_bytes) > cfg.max_output_bytes:
                    stderr_bytes = stderr_bytes[: cfg.max_output_bytes]
                    output_truncated = True

                stdout_str = stdout_bytes.decode("utf-8", errors="replace")
                stderr_str = stderr_bytes.decode("utf-8", errors="replace")
                if output_truncated:
                    stdout_str += f"\n[WARNING: Output truncated - exceeded {cfg.max_output_bytes} bytes limit]"

                exit_code = proc.returncode if proc.returncode is not None else 0

        except Exception as e:
            logger.error(f"Sandbox execution error: {e}", exc_info=True)
            stdout_str = ""
            stderr_str = f"Sandbox system failure: {str(e)}"
            exit_code = 1
        finally:
            if proc and proc.returncode is None:
                cls._kill_process_group(pgid)
                try:
                    await asyncio.wait_for(proc.wait(), timeout=1.0)
                except Exception:
                    pass
            # Secure workspace cleanup
            shutil.rmtree(temp_dir, ignore_errors=True)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Cryptographically seal execution evidence
        cmd_str = " ".join(command)
        hash_payload = f"{cmd_str}\n---\n{stdout_str}\n---\n{stderr_str}\n---\n{exit_code}"
        evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

        return ExecutionResult(
            exit_code=exit_code,
            stdout=stdout_str,
            stderr=stderr_str,
            duration_ms=duration_ms,
            timed_out=timed_out,
            cancelled=cancelled,
            output_truncated=output_truncated,
            execution_hash=evidence_hash,
            driver_used="hardened_subprocess",
            scratch_dir=temp_dir,
        )

    @classmethod
    def _kill_process_group(cls, pgid: Optional[int]):
        """Forcefully kills the entire child process group using SIGKILL."""
        if pgid is None:
            return
        try:
            os.killpg(pgid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


class SandboxManager:
    """
    High-level execution interface for untrusted code runs, AST mutation testing,
    and incident verification.
    """

    @classmethod
    def is_docker_available(cls) -> bool:
        """Checks if Docker daemon socket is writable and responsive."""
        sock_path = settings.DOCKER_HOST_SOCKET
        if os.path.exists(sock_path) and os.access(sock_path, os.R_OK | os.W_OK):
            return True
        return False

    @classmethod
    async def execute_in_sandbox(
        cls,
        command: List[str],
        cwd: Optional[str] = None,
        files: Optional[Dict[str, str]] = None,
        config: Optional[ExecutionSandboxConfig] = None,
        cancel_event: Optional[asyncio.Event] = None,
        copy_from_dir: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Executes a test run or mutation check within an isolated sandbox.
        Prefers HardenedSubprocessDriver with strict POSIX resource limits and secret scrubbing.
        """
        return await HardenedSubprocessDriver.execute(
            command=command,
            cwd=cwd,
            files=files,
            config=config,
            cancel_event=cancel_event,
            copy_from_dir=copy_from_dir,
        )


class JSTSSandboxHarness:
    """
    Centralized in-memory Vitest, Jest, and React mock harness
    and TypeScript syntax sanitizers for isolated Node.js sandbox execution.
    """

    VITEST_PKG_JSON: str = '{"name": "vitest", "main": "index.js", "type": "module"}'
    JEST_PKG_JSON: str = '{"name": "@jest/globals", "main": "index.js", "type": "module"}'
    REACT_PKG_JSON: str = '{"name": "react", "main": "index.js", "type": "module"}'

    VITEST_INDEX_JS: str = '''
export function describe(name, fn) {
  console.log(`SUITE: ${name}`);
  fn();
}
export function it(name, fn) {
  console.log(`  RUN: ${name}`);
  fn();
  console.log(`  PASS: ${name}`);
}
it.skip = (name, fn) => { console.log(`  SKIP: ${name}`); };
it.only = it;

export function test(name, fn) {
  console.log(`  RUN: ${name}`);
  fn();
  console.log(`  PASS: ${name}`);
}
test.skip = it.skip;
test.only = test;

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected} but received ${actual}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected deep equality matching ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected value to be defined');
    },
    toBeUndefined() {
      if (actual !== undefined) throw new Error(`Expected undefined but received ${actual}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null but received ${actual}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) throw new Error(`Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) throw new Error(`Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) throw new Error(`Expected ${actual} <= ${expected}`);
    },
    toBeCloseTo(expected, precision = 2) {
      if (Math.abs(actual - expected) > Math.pow(10, -precision)) {
        throw new Error(`Expected ${actual} to be close to ${expected} (precision: ${precision})`);
      }
    },
    toContain(item) {
      const ok = typeof actual === 'string' ? actual.includes(item) : (Array.isArray(actual) ? actual.includes(item) : false);
      if (!ok) throw new Error(`Expected container to contain ${item}`);
    },
    toHaveLength(len) {
      const actualLen = actual ? actual.length : 0;
      if (actualLen !== len) throw new Error(`Expected length ${len} but received ${actualLen}`);
    },
    toThrow(expectedMessage) {
      let threw = false;
      let thrownError = null;
      if (typeof actual === 'function') {
        try {
          actual();
        } catch (e) {
          threw = true;
          thrownError = e;
        }
      }
      if (!threw) {
        throw new Error('Expected function to throw an exception, but it did not throw.');
      }
      if (expectedMessage && thrownError) {
        const msg = thrownError.message || String(thrownError);
        if (!msg.includes(expectedMessage)) {
          throw new Error(`Expected thrown error message to include "${expectedMessage}", but received "${msg}".`);
        }
      }
    },
    not: {
      toBeNull() {
        if (actual === null) throw new Error('Expected value not to be null');
      },
      toBe(expected) {
        if (actual === expected) throw new Error(`Expected value not to be ${expected}`);
      },
      toEqual(expected) {
        if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(`Expected values not to deeply equal`);
      },
      toBeDefined() {
        if (actual !== undefined) throw new Error('Expected undefined');
      },
      toBeTruthy() {
        if (actual) throw new Error('Expected falsy');
      },
      toBeFalsy() {
        if (!actual) throw new Error('Expected truthy');
      },
      toContain(item) {
        const ok = typeof actual === 'string' ? actual.includes(item) : (Array.isArray(actual) ? actual.includes(item) : false);
        if (ok) throw new Error(`Expected not to contain ${item}`);
      },
      toThrow() {
        if (typeof actual === 'function') {
          try {
            actual();
          } catch (e) {
            throw new Error(`Expected function not to throw, but it threw: ${e.message}`);
          }
        }
      }
    }
  };
}
export default { describe, it, test, expect };
'''

    REACT_INDEX_JS: str = '''
export default {};
export const useState = (init) => [init, () => {}];
export const useEffect = () => {};
export const useCallback = (fn) => fn;
export const useMemo = (fn) => fn();
export const useRef = (init) => ({ current: init });
'''

    @classmethod
    def strip_typescript_types(cls, code: str) -> str:
        """Strips common TypeScript annotations to allow native Node.js ESM execution."""
        clean = re.sub(r':\s*(?:number|string|boolean|any|void|float|int)(?=[,\)])', '', code)
        clean = re.sub(r'\)\s*:\s*[a-zA-Z0-9_<>[\]|& ]+\s*\{', ') {', clean)
        clean = re.sub(r':\s*(?:number|string|boolean|any|void|float|int)\b', '', clean)
        return clean

    @classmethod
    def get_harness_files(cls) -> Dict[str, str]:
        """Returns standard in-memory package files for Node.js sandbox execution."""
        return {
            "package.json": '{"type": "module"}\n',
            "node_modules/vitest/package.json": cls.VITEST_PKG_JSON,
            "node_modules/vitest/index.js": cls.VITEST_INDEX_JS,
            "node_modules/@jest/globals/package.json": cls.JEST_PKG_JSON,
            "node_modules/@jest/globals/index.js": cls.VITEST_INDEX_JS,
            "node_modules/react/package.json": cls.REACT_PKG_JSON,
            "node_modules/react/index.js": cls.REACT_INDEX_JS,
        }

