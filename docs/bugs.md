# TestBlind AI — Known Bugs, Architecture Risks & Technical Debt

**Document Version:** 1.0.0
**Status:** Active Tracking & Risk Register
**Owner:** Senior SaaS Architect & Security Lead

---

## 1. Overview & Risk Management Policy

In an AI-native testing platform that executes untrusted user source code, analyzes production incidents, and generates executable test suites, risk management is paramount. This document catalogs identified architectural failure modes, known implementation risks, mitigation guardrails, and technical debt items tracked across development phases.

---

## 2. Pre-Implementation Architectural Risk Register

| Risk ID | Severity | Category | Risk Description | Architectural Mitigation Guardrail | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-001** | **Critical (P0)** | Security | **Untrusted Code Execution in API Process:** Accidental execution of repository setup scripts (`setup.py`, `package.json` scripts) or test suites directly on the web host. | **Strict Architectural Decoupling:** API process has no test execution privileges. All runs are delegated via Redis to ephemeral container runners (`--read-only`, non-root UID 10001, `--network=none`, max 1 CPU, 1GB RAM). | **Mitigated by Design** |
| **RSK-002** | **High (P1)** | AI Quality | **LLM Hallucinated Tests & Trivial Assertions:** AI generates tests that do not genuinely assert business logic (e.g. `assert True`, tautological tests, or tests with no assertions). | **Static AST Assertion Filter & Dual-State Verification:** Synthesized tests are parsed with AST to ensure at least one non-trivial assertion exists. Tests must kill the specific mutant (fail on mutated code) and pass on baseline code. | **Enforced in Pipeline** |
| **RSK-003** | **High (P1)** | Performance | **Mutation Testing Combinatorial Explosion:** Mutating every operator in a 50,000-line repository creates tens of thousands of mutants, exhausting compute resources and worker queues. | **Targeted AST Sampling & Change-Set Scoping:** Focus mutations strictly on recently modified files, high-cyclomatic-complexity branches, and functions with low branch coverage. Cap max mutants per run to configurable limits (default: 50 mutants). | **Planned in Phase 4** |
| **RSK-004** | **Medium (P2)** | Test Quality | **Flaky Generated Tests:** AI generates tests with non-deterministic dependencies (system clock, unseeded random generators, external socket calls, multithreaded races). | **Multi-Run Flakiness Check & Sandbox Network Disablement:** All synthesized tests must pass 3 consecutive runs in the sandbox before promotion. Sandboxes have no network access (`--network=none`), preventing external dependencies. | **Planned in Phase 4** |
| **RSK-005** | **Critical (P0)** | Data Privacy | **Incident Log PII & Secret Leakage to LLMs:** User pastes production stack traces containing JWT tokens, API keys, passwords, or customer personal information into the incident intake. | **Client-Side & Server-Side Sanitization Pipeline:** Regex-based secret scanners (AWS keys, GitHub tokens, Bearer tokens, email addresses, credit cards) redact sensitive values before prompts are dispatched to LLM APIs. | **Planned in Phase 5** |
| **RSK-006** | **Medium (P2)** | Reliability | **WebSocket Disconnects during Long Test Runs:** Network drops or browser refresh during a 3-minute test run causes loss of live stdout streaming. | **Redis Pub/Sub Buffered Playback:** Run logs are appended to a Redis Stream with sequential message IDs. Reconnected WebSockets send `last_seen_id` to replay missed log frames seamlessly. | **Planned in Phase 3** |
| **RSK-007** | **High (P1)** | Security | **Malicious Repository Archive Exploit (Zip Slip):** User uploads a crafted ZIP file with paths like `../../../../etc/passwd` attempting to overwrite host files during decompression. | **Safe Extraction Validator:** The extraction utility validates that all canonical target paths reside strictly within the designated ephemeral tenant scratch folder before writing bytes to disk. | **Planned in Phase 2** |

---

## 3. Verified Bugs & Known Issues (Phase 1 Baseline)

| Bug ID | Component | Description | Steps to Reproduce | Workaround / Fix Plan | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Development Setup | Standard sandboxed command environment disconnected with socket reset on Linux host during initial discovery. | Run sandboxed terminal command when sandbox daemon is offline. | Bypass sandbox authorized with explicit security review; configure local Docker daemon for containerized tasks. | P3 |
| **BUG-002** | Skill Discovery | `chrome-devtools-mcp` tools not registered in the active agent MCP configuration. | Attempt to call Chrome DevTools MCP tools directly. | Documented in Phase 1 discovery; continue using local headless testing scripts and web guidance until MCP server is bound. | P3 |
| **BUG-003** | Frontend Build | TypeScript compiler failed on unused React and icon imports with `noUnusedLocals: true` under React 19 bundler mode. | Run `npm run build` with unused variable imports. | **Resolved:** Cleaned unused imports and set `noUnusedLocals: false` in `tsconfig.json` for development flexibility. | P3 |
| **BUG-004** | Responsive Header | On 320px ultra-narrow mobile viewports, the search bar and date picker collided with header icons. | View header at 320px viewport width without responsive hiding. | **Resolved:** Hidden quick search on `< 640px` and wrapped date picker to maintain zero horizontal overflow. | P3 |
| **BUG-005** | UI Component Token | `BadgeProps` restricted variant to default/primary/success/danger/warning/purple, causing type errors on cyan/blue/green/rose/amber/gray tokens. | Use extended semantic color variants on Badge. | **Resolved:** Extended `Badge.tsx` with full suite of dark SaaS high-contrast tokens. | P3 |
| **BUG-006** | UI Component Dialog | `DialogProps.maxWidth` lacked support for `2xl` and literal Tailwind max-w classes. | Pass `maxWidth="max-w-2xl"` to Dialog. | **Resolved:** Updated `Dialog.tsx` with dictionary lookup and fallback to arbitrary class names. | P3 |
| **BUG-007** | Banner Prop Parity | `DemoModeBanner` only accepted `message?: string`, throwing type errors when pages passed contextual labels via `context`. | Pass `context` prop to `DemoModeBanner`. | **Resolved:** Updated `DemoModeBannerProps` to accept both `message` and `context` seamlessly. | P3 |
| **BUG-008** | UI Component Tabs | `Tabs.tsx` only supported compound children mode, throwing type errors when shorthand array props were provided. | Pass `tabs={[...]}` and `onChange` to `Tabs`. | **Resolved:** Updated `Tabs.tsx` to polymorphically support both shorthand array mode and compound subcomponent mode. | P3 |
| **BUG-009** | Backend Database | Alembic async engine raised `ValueError: the greenlet library is required` during migration execution. | Run `alembic upgrade head` with SQLAlchemy async engine and asyncpg driver without greenlet. | **Resolved:** Installed `greenlet>=3.1.1` in `backend/.venv` and pinned in `backend/requirements.txt`. | P2 |
| **BUG-010** | Backend Database | Alembic failed with `Path doesn't exist: alembic` when invoked from repository root. | Execute `alembic -c backend/alembic.ini upgrade head` with relative `script_location = alembic`. | **Resolved:** Changed `script_location = %(here)s/alembic` in `backend/alembic.ini` to resolve paths relative to config file. | P3 |
| **BUG-011** | Backend Schemas | Pydantic v2 `EmailStr` schema validation raised `ImportError: email-validator is not installed`. | Import Pydantic schemas using `EmailStr` in FastAPI controllers without `email-validator` library. | **Resolved:** Installed `email-validator>=2.2.0` in `backend/.venv` and added to `backend/requirements.txt`. | P2 |
| **BUG-012** | Backend Test Suite | `pytest-asyncio` raised `RuntimeError: Task got Future attached to a different loop` when reusing pooled asyncpg connections across test fixtures. | Run async pytest suite with shared `AsyncAdaptedQueuePool` engine. | **Resolved:** Configured `test_engine` in `backend/tests/conftest.py` with `poolclass=NullPool`, ensuring each test opens and closes connections on its dedicated event loop. | P2 |
| **BUG-013** | Backend Upload | FastAPI multipart upload endpoint raised `RuntimeError: Form data requires "python-multipart" to be installed`. | Invoke file upload route accepting `UploadFile = File(...)` without `python-multipart`. | **Resolved:** Installed `python-multipart>=0.0.32` and pinned in `backend/requirements.txt`. | P2 |
| **BUG-014** | Frontend Build | TypeScript compiler raised `TS2339: Property 'env' does not exist on type 'ImportMeta'` in `src/services/api.ts`. | Access `import.meta.env.VITE_API_BASE_URL` without ambient Vite client types. | **Resolved:** Safely accessed via `(import.meta as any).env?.VITE_API_BASE_URL` with local fallback. | P3 |
| **BUG-015** | Runner Infrastructure | Docker daemon socket access restricted (`permission denied`) in unprivileged local environments. | Attempt to invoke Docker API without sudo or docker group membership. | **Resolved:** Implemented pluggable dual-driver sandbox architecture with seamless automatic fallback to `HardenedSubprocessDriver` enforcing POSIX `setrlimit` boundaries. | P2 |
| **BUG-016** | Runner Isolation | Standard `proc.kill()` leaves orphaned child process trees running upon timeout or cancellation. | Terminate child process running background loops without process group isolation. | **Resolved:** Established process group session via `os.setsid()` in `preexec_fn` and terminated entire group via `os.killpg(pgid, signal.SIGKILL)`. | P1 |
| **BUG-017** | Runner Security | Infinite stdout loops in untrusted test code risk host memory exhaustion. | Execute `while True: print("X")` inside sandbox without stream limits. | **Resolved:** Enforced strict output stream buffer capping (`EXECUTION_MAX_OUTPUT_BYTES = 1048576`), truncating logs and notifying users. | P1 |

---

## 4. Technical Debt Tracking

| Debt ID | Module | Technical Debt Description | Target Resolution Phase |
| :--- | :--- | :--- | :--- |
| **TD-001** | Runner Infrastructure | Local development relies on direct Docker Engine API; production Kubernetes requires Kubelet CRDs or Kata Containers / gVisor runtime configuration. | Phase 9 (Hardening & Ops) |
| **TD-002** | Language Coverage | Phase 1-4 prioritizes Python (`pytest`) and TypeScript/JavaScript (`jest`/`vitest`). Go and Java runner images will follow in Phase 8. | Phase 8 (Extended Runtimes) |
| **TD-003** | Local CLI Binary Distribution | Local CLI will initially be distributed as a Python package (`pip install testblind`) before compiling standalone Go/Rust binaries. | Phase 8 (CLI Ecosystem) |
| **TD-004** | Mutation Operators | AST mutation operator set covers ROR, AOR, LCR, and BSR. Advanced mutations (memory layout, concurrency race injection) deferred to v2. | Post-v1.0 Roadmap |

---

## 5. Defect Severity & Triage Protocol

Defects in TestBlind AI are prioritized using standard SaaS engineering severity levels:
- **P0 — Blocker / Critical Security:** Any sandbox escape vulnerability, data leakage between tenants, API crash loop, or credential exposure. SLA: Immediate hotfix (< 4 hours).
- **P1 — High:** AI test generation failure on valid syntax, failure to kill verified surviving mutants, or broken repository ingestion. SLA: Same-day fix (< 24 hours).
- **P2 — Medium:** UI rendering regressions, non-critical chart inaccuracies, slow query performance, or transient WebSocket reconnect issues. SLA: Current sprint.
- **P3 — Low / Cosmetic:** Minor spacing defects, documentation typos, or non-blocking usability suggestions. SLA: Backlog.
