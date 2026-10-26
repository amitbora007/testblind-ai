# TestBlind AI — Phased Implementation Plan & Acceptance Criteria

**Document Version:** 1.2.0  
**Status:** Approved Master Roadmap  
**Current Phase:** Phase 8 (Incident-to-Regression Pipeline & Dual-State Verification) — Completed  
**Next Phase:** Phase 9 (Hardening, Security Audits, E2E Verification & Launch)  

---

## 1. Roadmap Overview & Implementation Phases

The development of TestBlind AI is structured into nine sequential engineering phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation, Specification & Architecture [COMPLETED]               │
│ - Canonical specs (product-spec.md, architecture.md, design.md, bugs.md)    │
│ - Tech stack validation & design system token definitions                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Design System & Application Shell [COMPLETED]                      │
│ - React 19 + TypeScript + Vite + Tailwind CSS design primitives             │
│ - TraceAI Studio Dashboard benchmark (4 metric cards, stacked bars, donut)  │
│ - 11 navigation routes, collapsible sidebar, responsive mobile navigation   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Frontend Screens & Workflows [COMPLETED]                           │
│ - 13 production screens: Dashboard, Projects, Repos, Code Lab (Monaco),     │
│   Gap Discovery, Incidents, Cases, Scenarios, Runs, Reports, Insights,      │
│   Integrations, Team & Settings                                             │
│ - Real browser verification across 5 viewports (320px–1440px)               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Core Data Models, Authentication & Multi-Tenancy [COMPLETED]       │
│ - PostgreSQL 16 schema, SQLAlchemy models, Alembic migrations               │
│ - Tenant isolation, RBAC (Owner/Admin/Engineer/Viewer), JWT auth            │
│ - 20/20 automated pytest test suite passing with 100% success rate          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Repository Integrations, Code Intake & Code Lab [COMPLETED]        │
│ - Safe ZIP intake, Zip Slip / Zip Bomb defense, test runner auto-detection   │
│ - Zero-trust GitHub integration, Standalone Code Lab sandbox, Local CLI     │
│ - 34/34 total automated pytest tests passing (14 new Phase 5 tests)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Execution Infrastructure & Secure Sandboxing [COMPLETED]           │
│ - In-memory/Redis job queue with bounded concurrency (4 workers)            │
│ - Hardened subprocess/Docker sandbox drivers with POSIX setrlimit quotas    │
│ - Process group isolation (os.setsid/SIGKILL), 1MB output cap, scrubbing   │
│ - 45/45 total automated pytest tests passing (11 new Phase 6 tests)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 7: AI Test Gap Discovery Engine [COMPLETED]                           │
│ - AST mutation generation across ROR, AOR, LCR, and BSR operator families   │
│ - Dual-state verification (Pass pristine baseline, Fail mutated code)       │
│ - Real sandbox execution calculating empirical mutation kill score          │
│ - 56/56 total automated pytest tests passing (11 new Phase 7 tests)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 8: Incident-to-Regression Pipeline & Dual-State Verification [COMPLETED]│
│ - Stack trace parser, fault anchor mapping, PII & secret redactor           │
│ - Dual-state verification (Fail on buggy code, Pass on corrected code)      │
│ - Promotion to shared regression test library with cryptographic hash       │
│ - 67/67 total automated pytest tests passing (11 new Phase 8 tests)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 9: Hardening, Security Audits, E2E Verification & Launch [PLANNED]   │
│ - Container breakout penetration testing, load testing (100+ sandboxes)     │
│ - Full regression test suite, documentation reconciliation, launch         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Scope & Detailed Acceptance Criteria

### Phase 1: Foundation, Specification & Architecture (COMPLETED)
- **Scope:**
  - Workspace inspection, git initialization, and tool verification.
  - Skill discovery (`ui-ux-pro-max`, `frontend-design`, `modern-web-guidance`, `chrome-dev-tools`).
  - Analysis of visual design benchmark (`references/aitool.jpeg`).
  - Creation of all canonical documentation files in `docs/`: `product-spec.md`, `architecture.md`, `design.md`, `bugs.md`, `deployment.md`, `readme.md`, `implementation-plan.md`.
- **Acceptance Criteria:**
  - [x] All canonical documentation files exist and are reconciled with each other.
  - [x] Core product workflows (AI Test Gap Discovery, Incident-to-Regression) are exhaustively defined.
  - [x] Sandboxed execution architecture and security defense-in-depth are documented.
  - [x] TraceAI Studio design tokens and responsive breakpoints are specified.
  - [x] Architectural risk register (`bugs.md`) catalogs failure modes and mitigations.
  - [x] Git repository is initialized with clean status.

---

### Phase 2: Design System & Application Shell (COMPLETED)
- **Scope:**
  - Scaffolding of React 19 + TypeScript + Vite + Tailwind CSS frontend application.
  - BlindShield Design System primitives: Button, Input, Select, Card, Badge, StatusPill, Table, Tabs, Dialog, NotificationToast, States (Loading, Skeleton, Empty, Error).
  - TraceAI Studio Application Shell: Collapsible sidebar (11 routes: Dashboard, Projects, Test Gap Discovery, Incident Analysis, Test Cases, Test Scenarios, Execution Runs, Reports, AI Insights, Integrations, Team & Settings), header with breadcrumbs, environment switcher, search palette, date filter, profile badge, and mobile drawer.
  - Representative Screen: TraceAI Studio Dashboard matching `references/aitool.jpeg` (4 KPI metric cards, 12-week stacked bar chart, requirement coverage donut chart, recent test scenarios table with detail inspector).
  - Interactive Component State Harness: live toggling between Normal Data, Loading, Empty, Error, Dialog, and Toast states.
- **Acceptance Criteria:**
  - [x] BlindShield design system primitives and OLED dark palette fully implemented and typed.
  - [x] Collapsible desktop sidebar (240px <-> 68px) and mobile slide-over drawer operational.
  - [x] Dashboard faithfully realizes `references/aitool.jpeg` with high information density and zero visual clutter.
  - [x] Responsive layout verified in real browser (Google Chrome Headless) across 320px, 375px, 768px, 1024px, and 1440px with zero horizontal scroll overflow.
  - [x] Component states (Normal, Loading, Empty, Error, Dialog, Toast) interactively switchable and verified.
  - [x] `npm run build` passes with 0 errors.

---

### Phase 3: Frontend Screens & Workflows (COMPLETED)
- **Scope:**
  - Build interactive frontend screens for all 13 core workflows in `frontend/src/pages/`:
    1. Dashboard (`DashboardPage.tsx`) — TraceAI Studio hierarchy, 4 KPI cards, 12-week stacked bar chart, donut requirement coverage, recent test scenarios table, interactive component state harness, and explicit demo banner.
    2. Projects (`ProjectsPage.tsx`) — Search, framework filtering, project health metrics, and interactive project creation modal.
    3. Repository Connection & Upload (`RepositoriesPage.tsx`) — GitHub App OAuth connect flow, branch selector, drag-and-drop ZIP upload with 100MB quota guardrail, and local CLI runner instructions.
    4. Standalone Code Lab (`CodeLabPage.tsx`) — Monaco code editor with multi-language selector (Python/TS/Go), source code / unit tests / invariant tabs, separate AI suggestions, generated tests, and sandbox execution panels. Desktop side-by-side split view and mobile stacked view.
    5. Test Gap Discovery (`GapDiscoveryPage.tsx`) — AST mutation testing matrix, operator filter buttons (ROR, AOR, LCR, BSR), surviving mutant inspection drawer with diff viewer, and test synthesis.
    6. Incident-to-Regression Generation (`IncidentAnalysisPage.tsx`) — Incident intake modal, stack frame parser, AI root-cause hypothesis, and dual-state verification console (State A: Buggy Red vs State B: Fixed Green).
    7. Test Cases Repository (`TestCasesPage.tsx`) — Catalog with search, status/language filters, creation modal, and real client-side JSON export.
    8. Test Scenarios Matrix (`TestScenariosPage.tsx`) — Multi-step integration suites linked to requirement codes, step-by-step pipeline visualizer, and creation modal.
    9. Execution Runs Console (`ExecutionRunsPage.tsx`) — Historical runs table with status pills, duration, trigger source, and slide-over terminal log drawer displaying airgapped container runner output.
    10. Test Health & Audit Reports (`ReportsPage.tsx`) — Mutation score trends, multi-layer code coverage comparison, flakiness index, and real CSV/JSON export download actions.
    11. AI Test Intelligence & Insights (`AiInsightsPage.tsx`) — Flaky test predictions (concurrency races, unseeded randoms, timeout risks), redundant test pruning, coverage gap optimizer with one-click test synthesis.
    12. Integrations Fabric (`IntegrationsPage.tsx`) — Connection cards for GitHub, GitLab, Slack, Jira, configuration modals, and on-premises `testblind-cli` token generator with one-click copy.
    13. Team & Workspace Settings (`TeamSettingsPage.tsx`) — Organization profile, RBAC member management with invite modal, container runner security quotas (CPU, RAM, 60s hard timeout, `--network=none`, `--read-only`, non-root UID 10001), and API key management.
  - Wire all 13 screens into `App.tsx` with deep-linking client URL hash sync.
  - Headless browser verification across 5 responsive breakpoints (320px, 375px, 768px, 1024px, 1440px).
- **Acceptance Criteria:**
  - [x] All 13 production screens are implemented and wired in `App.tsx`.
  - [x] Monaco code editor embedded in Code Lab with multi-language support, split-panel desktop layout, and stacked mobile layout.
  - [x] All critical controls perform real interactive actions (no blank placeholders or dead buttons).
  - [x] Demo mode indicator (`DemoModeBanner`) clearly demarcates simulated telemetry from verified sandbox evidence.
  - [x] `npm run build` compiles with 0 errors and 0 warnings.
  - [x] Headless Google Chrome tests capture full visual proof across 320px–1440px with zero horizontal scroll overflow.

---

### Phase 4: Core Data Models, Authentication & Multi-Tenancy (COMPLETED)
- **Scope:**
  - Build asynchronous Python + FastAPI 0.115+ control plane backend with typed Pydantic v2 schemas and versioned REST endpoints (`/api/v1`).
  - PostgreSQL 16 database design with 16 tables across the core SaaS domain:
    - Identity & Tenancy: `organizations`, `users`, `user_memberships`.
    - Workspaces & Repositories: `projects`, `repositories`.
    - AST Mutation & Test Gaps: `scan_jobs`, `findings`, `mutations`.
    - Test Catalog & Scenarios: `test_cases`, `test_scenarios`, `test_scenario_members`.
    - Executions & Isolated Sandboxes: `execution_runs`, `run_steps`.
    - Incidents & Regression: `incidents` (with dual-state verification states).
    - Platform Operations: `integration_settings`, `audit_events`.
  - SQLAlchemy 2.0 async ORM declarative mappings and Alembic version-controlled migration scripts (`001_initial_schema.py`).
  - Direct bcrypt password hashing (work factor 12) and PyJWT authentication token issuing/validation (HS256).
  - Server-side multi-tenant isolation dependency (`get_tenant_context`): verifies active organization membership before allowing access, rejecting cross-tenant or forged `X-Organization-ID` requests with HTTP 403 Forbidden.
  - Hierarchical Role-Based Access Control (`require_role`): enforces role permissions (`owner` > `admin` > `engineer` > `viewer`).
  - Production REST API endpoints:
    - `/healthz` & `/readyz` probes for Kubernetes / container orchestration.
    - `/api/v1/auth`: registration, JWT login, and profile lookup (`/me`).
    - `/api/v1/organizations`: organization creation, member listing, and member invites.
    - `/api/v1/projects`: project creation, listing, detail, and repository linking.
    - `/api/v1/dashboard`: KPI metrics, 12-week execution bar chart data, and requirement coverage distribution.
    - `/api/v1/scan-jobs`: mutation scan triggering, status checks, and mutation filtering (by operator and status).
    - `/api/v1/test-cases`: test case catalog with verification status filtering.
    - `/api/v1/test-scenarios`: multi-step integration suite management.
    - `/api/v1/execution-runs`: historical run logs and granular execution step timelines.
    - `/api/v1/incidents`: incident intake, AST fault frame parsing, and dual-state verification.
    - `/api/v1/reports`: mutation scores, code coverage metrics, and real JSON/CSV export generation.
    - `/api/v1/ai-insights`: flaky test predictions, coverage gap optimizations, and test synthesis suggestions.
    - `/api/v1/integrations`: third-party tool configurations and CLI runner token issuance (`tb_runner_...`).
    - `/api/v1/audit`: security and administrative event audit log stream.
  - Comprehensive automated Pytest test suite (`backend/tests/`) running against live PostgreSQL with isolated transactions.
- **Acceptance Criteria:**
  - [x] All 16 database tables successfully migrated via Alembic (`alembic upgrade head`) and verified.
  - [x] Secure authentication with bcrypt password hashing and PyJWT tokens operational (`test_auth.py` passing 6/6 tests).
  - [x] Server-side multi-tenant isolation enforced; forged `X-Organization-ID` headers rejected with 403 Forbidden (`test_tenancy.py` passing 4/4 tests).
  - [x] Cross-tenant isolation guarantees projects, incidents, and execution logs of Tenant A are inaccessible to Tenant B (HTTP 404/403).
  - [x] Hierarchical RBAC verified: Viewers cannot create projects or trigger scans, Engineers cannot invite members, Admins/Owners have full administrative access (`test_rbac.py` passing 3/3 tests).
  - [x] Full core domain API workflows pass: health/readiness, project creation, scan jobs, test cases, scenarios, dual-state incident verification, dashboard KPIs, reports export, and integrations (`test_api_workflows.py` passing 7/7 tests).
  - [x] Zero API Process Execution Rule strictly enforced: FastAPI web process serves purely as Control Plane; untrusted test runs delegated to runner sandboxes.
  - [x] Pytest suite passes 20/20 tests with 100% success rate.

---

### Phase 5: Repository Integrations, Code Intake & Standalone Code Lab (COMPLETED)
- **Scope:**
  - Build defensive repository intake pipeline supporting GitHub App / OAuth and secure local ZIP file ingestion.
  - Safe Archive Extractor (`backend/app/services/archive_service.py`):
    - Magic byte signature check (`PK\x03\x04` / `PK\x05\x06`), rejecting renamed binaries with HTTP 400.
    - Zip Slip path traversal mitigation: enforces `os.path.commonpath([dest_dir, target_path]) == dest_dir`, rejecting any `..` or root escaping paths with a security alert.
    - Zip Bomb mitigation: caps uncompressed size to 500MB, file count to 10,000, and rejects abnormal compression ratios (> 100:1).
    - Rejection of malicious symbolic link entries.
  - Project Structure Detector:
    - Auto-detection of programming languages (`python`, `typescript`, `javascript`, `go`, `java`).
    - Auto-detection of test runners and suggested commands (`pytest`, `jest`, `vitest`, `go test`, `mvn test`).
    - File manifest gathering and project framework synchronization.
  - GitHub App / OAuth Integration:
    - Zero-trust credential model: when `GITHUB_CLIENT_ID`/`SECRET` are unset, API explicitly returns `configured: false, connected: false` and setup instructions; never simulates connection.
    - Secure token storage in `IntegrationSetting` and audit event logging.
    - Repositories, branch selection, and commit listing endpoints.
  - Standalone Code Lab Service & Sandboxing:
    - AST parsing of standalone snippets (functions, branches, and comparison operators `ROR`).
    - Mutation candidate generation (e.g. `>` to `>=`).
    - Targeted boundary test synthesis.
    - Sub-second ephemeral execution sandbox capturing stdout/stderr and sealing results with SHA-256 evidence hashes.
    - Strict semantic demarcation: source-only AI suggestions (`is_executable: false`) vs executed sandbox evidence (`is_executable: true`).
  - On-Premise Local CLI Companion (`testblind`):
    - Airgapped local scanning for developers who cannot upload proprietary source code.
    - Performs local AST analysis and test runner detection without transmitting raw code bytes off-host.
  - Frontend UI Integration:
    - `RepositoriesPage.tsx`: Honest unconfigured GitHub alert card, real ZIP upload progress bar, structure detection chips, and CLI interactive copy.
    - `CodeLabPage.tsx`: Live AST analysis, test proposal synthesis, sandbox execution logs, and semantic status badges.
- **Acceptance Criteria:**
  - [x] Valid ZIP repositories are extracted safely and correctly detect language and test runner (`test_zip_upload_valid_python_repo`, `test_zip_upload_valid_typescript_repo`).
  - [x] Non-ZIP files and renamed binaries are rejected with HTTP 400 via magic byte verification (`test_zip_upload_invalid_non_zip_file`).
  - [x] Malicious Zip Slip archive entries (`../../../../etc/passwd`) are rejected with HTTP 400 security alert (`test_zip_upload_malicious_path_traversal_zip_slip`).
  - [x] Unsupported archive formats (.tar.gz, .rar) are rejected (`test_zip_upload_unsupported_archive_type`).
  - [x] Scratch files are purged on demand via retention cleanup endpoint (`test_zip_upload_retention_and_cleanup`).
  - [x] Unconfigured GitHub environment displays clear setup state and instructions; never claims connection succeeded (`test_github_status_unconfigured`, `test_github_connect_unconfigured_error`).
  - [x] GitHub repository and branch selection works when configured (`test_github_configured_workflow_and_linking`).
  - [x] RBAC authorization restricts Viewers from uploading repository archives (`test_repository_authorization_rbac`).
  - [x] Standalone Code Lab performs AST parsing without repository requirement and marks suggestions as `is_executable: false` (`test_codelab_analyze_python_ast`).
  - [x] Code Lab synthesizes targeted boundary assertions (`test_codelab_synthesize_boundary_test`).
  - [x] Code Lab sandbox executes tests, captures stdout/stderr, and seals proof with SHA-256 hash with `is_executable: true` (`test_codelab_execute_sandbox`).
  - [x] All 34 automated backend pytest tests pass with 100% success rate (`pytest backend/tests -v`).
  - [x] Frontend builds with 0 errors (`npm run build`).
---

### Phase 6: Execution Infrastructure & Secure Sandboxing (COMPLETED)
- **Scope:**
  - Build asynchronous background queue engine and isolated runner sandboxes for untrusted code execution.
  - Background Queue & Bounded Worker Fleet (`backend/app/services/queue_service.py`):
    - In-memory job queue with Redis queue backing abstraction.
    - Bounded worker fleet concurrency (`MAX_CONCURRENT_WORKERS = 4`).
    - Per-tenant fair-share run quotas (`MAX_TENANT_CONCURRENT_RUNS = 2`).
    - Idempotency key registry preventing duplicate job dispatch and worker allocation.
    - Asynchronous job submission and non-blocking status retrieval.
    - Immediate cancellation handling (`POST /api/v1/execution-runs/{id}/cancel`, `POST /api/v1/scan-jobs/{id}/cancel`) with active process group kill.
    - Exponential backoff retry policies for transient failures (`max_retries = 2`, `backoff_factor = 2.0`).
    - Worker fleet healthcheck (`GET /api/v1/workers/health`) and queue stats (`GET /api/v1/queue/stats`).
    - FastAPI lifespan hook for graceful worker fleet startup and draining shutdown.
  - Hardened Execution Sandbox Engine (`backend/app/services/sandbox_service.py`):
    - Dual-driver runner architecture: `DockerSandboxDriver` with automated seamless fallback to `HardenedSubprocessDriver`.
    - POSIX kernel resource quotas via `resource.setrlimit`: `RLIMIT_CPU` (30s soft / 60s hard), `RLIMIT_AS` (512MB RAM), `RLIMIT_NPROC` (64 processes max), `RLIMIT_FSIZE` (20MB).
    - Process group isolation via `os.setsid()` and recursive cleanup via `os.killpg(pgid, signal.SIGKILL)`.
    - Output buffer memory exhaustion protection: stdout/stderr capped at 1MB with `[OUTPUT TRUNCATED]` warning.
    - Ephemeral scratch workspaces (`/tmp/testblind_sandboxes/{sandbox_id}`) purged upon completion.
    - Zero-leak credential scrubber stripping sensitive environment variables (`SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `DATABASE`, `POSTGRES`, `JWT`, `AWS`, `MINIO`, `GITHUB`, `AUTH`).
    - SHA-256 evidence sealing for execution proof.
  - Automated Pytest Test Suite (`backend/tests/test_execution_infrastructure.py`):
    - 11 comprehensive tests covering secret scrubbing, timeouts, cancellation, output truncation, bounded concurrency, retries, idempotency, execution run API cancellation, scan job API cancellation, tenant isolation, and health/stats endpoints.
- **Acceptance Criteria:**
  - [x] Environment secret scrubbing sanitizes all sensitive environment variables (`test_sandbox_secret_scrubbing`).
  - [x] Wall timeout enforcement terminates hanging infinite processes with exit code 124 (`test_sandbox_timeout_enforcement`).
  - [x] Sandbox process group cancellation successfully kills multi-process tree with exit code 130 (`test_sandbox_cancellation`).
  - [x] Output buffer truncation caps excessive test stdout to limit with explicit truncation marker (`test_sandbox_output_truncation`).
  - [x] Bounded queue concurrency caps active worker executions to MAX_CONCURRENT_WORKERS=4 (`test_queue_bounded_concurrency`).
  - [x] Transient failure retries execute with exponential backoff (`test_queue_retry_policy`).
  - [x] Idempotent submission returns existing job without duplicate worker execution (`test_queue_idempotency`).
  - [x] Execution run API cancellation transitions run to CANCELLED and kills sandbox process (`test_execution_run_cancellation_api`).
  - [x] Scan job API cancellation transitions scan job to CANCELLED and halts analysis (`test_scan_job_cancellation_api`).
  - [x] Multi-tenant isolation prevents cross-tenant job cancellation or detail access (`test_cross_tenant_job_isolation`).
  - [x] Operational endpoints return real worker health and queue metrics (`test_queue_and_worker_health_endpoints`).
  - [x] Full test suite of 45/45 automated pytest tests passing with 100% success rate across all 6 test suites.
  - [x] Frontend builds with 0 errors (`npm run build`).

---

### Phase 7: AI Test Gap Discovery Engine (COMPLETED)
- **Scope:**
  - AST-based mutation engine (`backend/app/services/mutation_engine.py`) generating mutants across 4 standard operator families:
    - ROR (Relational Operator Replacement: `<`, `>`, `<=`, `>=`, `==`, `!=`, `in`, `not in`, `is`, `is not`).
    - AOR (Arithmetic Operator Replacement: `+`, `-`, `*`, `/`, `//`, `%`, `**`).
    - LCR (Logical Connector Replacement: `and` <-> `or`, `not` inversion).
    - BSR (Boundary Shift Replacement: off-by-one constant shifts, boolean inversions).
    - AST syntax compilation validation (`compile(mutated_ast, ..., 'exec')`) filtering invalid syntax and detecting equivalent mutants.
  - Test Discovery Service (`backend/app/services/discovery_service.py`):
    - Recursive workspace discovery of Python source files and pytest suites.
    - Baseline test execution running unmutated tests in the isolated execution sandbox (`run_baseline_tests`).
    - Mutant execution (`execute_mutant`) comparing exit codes to detect killed vs surviving vs timeout mutants.
    - Full workspace scan computing empirical mutation score: $\text{Score} = (\text{Killed} / (\text{Total} - \text{Equivalent} - \text{Invalid})) \times 100\%$.
  - LLM Gap Explanation & Test Synthesizer (`backend/app/services/llm_service.py`):
    - Explains why surviving mutations escaped existing test assertions.
    - Synthesizes targeted boundary pytest assertions with deterministic fallback.
  - Dual-State Verification Engine (`backend/app/services/validation_service.py`):
    - Gate 1: Pristine Baseline Run -> Must PASS (exit code 0). Rejects hallucinated syntax as `execution_failure`.
    - Gate 2: Mutated Code Run -> Must FAIL (exit code != 0). Certifies test as `mutation_killing` with SHA-256 evidence hash.
  - Database Migration & Schemas (`002_add_mutation_synthesis_fields.py`):
    - Added `synthesized_test_code`, `verification_status`, `evidence_hash`, `explanation`, `missing_boundary` to `mutations`.
  - API Endpoints & Frontend:
    - `POST /api/v1/projects/{id}/scan-jobs/sync`: Run synchronous mutation scan and return score & mutants.
    - `POST /api/v1/scan-jobs/{job_id}/mutations/{mutation_id}/synthesize`: Synthesize test and run dual-state verification.
    - `POST /api/v1/scan-jobs/{job_id}/mutations/{mutation_id}/promote`: Promote verified killer test into `test_cases` catalog.
    - `GapDiscoveryPage.tsx`: Live integration with projects dropdown, real-time KPI metrics, AST substitution diff modal, operator filtering, synthesis trigger, and verified killer badge.
- **Acceptance Criteria:**
  - [x] AST mutation engine generates syntactically valid mutants across ROR, AOR, LCR, and BSR (`test_ast_mutation_engine_operators`, `test_ast_mutation_invalid_syntax_filter`).
  - [x] Equivalent mutant detection marks unprovable mutations without skewing score (`test_ast_mutation_equivalent_detection`).
  - [x] Source and test file discovery accurately identifies Python modules and test files (`test_test_discovery_service`).
  - [x] Baseline test execution measures unmutated test pass rate in sandbox (`test_baseline_test_execution_success_and_failure`).
  - [x] Ephemeral execution sandboxes execute tests against mutants and compute accurate kill rates (`test_mutant_sandbox_execution_killed_and_survived`).
  - [x] Full workspace scan calculates dynamic mutation score (`test_full_workspace_mutation_scan`).
  - [x] LLM service synthesizes targeted edge-case pytest assertions (`test_llm_synthesize_killing_test`).
  - [x] Dual-state validator certifies killing proof (pass pristine, fail mutant) with SHA-256 evidence hash (`test_dual_state_validation_success`).
  - [x] Dual-state validator rejects hallucinations failing on baseline code (`test_dual_state_validation_rejects_hallucinated_tests`).
  - [x] API endpoints support synchronous scan, synthesis, and test promotion (`test_api_scan_job_sync_and_mutations`, `test_api_synthesize_and_promote_mutation`).
  - [x] Full test suite of 56/56 automated pytest tests passing with 100% success rate across 7 test suites.
  - [x] Frontend builds with 0 errors (`npm run build`).

---

### Phase 8: Incident-to-Regression Pipeline & Dual-State Verification (COMPLETED)
- **Scope:**
  - Multi-field incident intake API (`IncidentCreate`, `IncidentRead`, `IncidentUpdate`) validating title, severity, description, expected vs actual behavior, commit, and stack trace logs.
  - Server-side PII and credential sanitization scanner (`app/core/sanitization.py`) automatically redacting AWS keys, GitHub tokens, Bearer JWTs, database connection URIs, credit cards, and emails.
  - Traceback parser (`IncidentAnalysisService.parse_traceback`) decomposing Python stack traces into structured `StackFrame` objects, extracting exception types, messages, and mapping fault module/line anchors.
  - Context adequacy evaluator setting status to `needs_more_info` with explicit `missing_details` when faulting source code is unavailable, preventing synthetic hallucinations.
  - Candidate reproduction test synthesizer generating targeted pytest assertions that exercise the unhandled exception conditions.
  - Dual-State Verification Engine (`IncidentAnalysisService.verify_dual_state`):
    - State A (Buggy Codebase): Asserts candidate test FAILS (`exit_code != 0`), reproducing the reported defect signature (`Reproduction Verified`).
    - State B (Corrected Codebase): Asserts candidate test PASSES cleanly (`exit_code == 0`) when fix code is supplied (`Fix Verified`).
    - Sealing execution proofs with an immutable SHA-256 evidence hash.
  - Shared Regression Test Library integration:
    - `POST /api/v1/incidents/{id}/promote`: Promotes verified tests into the permanent `test_cases` table with incident provenance.
    - `GET /api/v1/incidents/{id}/export`: Exports test as downloadable `.py` file.
  - Frontend UI (`IncidentAnalysisPage.tsx`):
    - Live project selection, incident intake modal, sanitized traceback viewer, AI hypothesis card, editable reproduction test code block, dual-state terminal runner console, and one-click library promotion.
- **Acceptance Criteria:**
  - [x] Pasting a Python ZeroDivisionError or IndexError stack trace extracts the exact faulting module and line (`test_incident_intake_validation`, `test_incident_ai_analysis_and_synthesis`).
  - [x] Sensitive tokens, passwords, database URIs, emails, and credit cards are scrubbed prior to storage (`test_incident_secret_and_pii_sanitization`).
  - [x] Missing source code or reproduction details transitions incident to `needs_more_info` without ungrounded claims (`test_incident_missing_context_handling`).
  - [x] The generated reproduction test fails on the buggy code snippet matching the incident error (`test_incident_dual_state_verification_success`).
  - [x] The test passes cleanly when run against the corrected code snippet establishing dual-state proof (`test_incident_dual_state_verification_success`).
  - [x] Tests that unexpectedly pass on buggy code are flagged as `failed_to_reproduce` (`test_incident_failed_to_reproduce`).
  - [x] Verified tests are cataloged in the shared regression suite with immutable incident link and SHA-256 evidence hash (`test_incident_promote_to_regression_catalog`).
  - [x] Tenant isolation prevents cross-tenant incident access or verification (`test_incident_tenant_isolation`).
  - [x] RBAC authorization restricts Viewers from creating or verifying incidents (`test_incident_rbac_authorization`).
  - [x] Controlled realistic defect example (invoice prorate ZeroDivisionError on leap year) verified end-to-end (`test_controlled_billing_incident_example` / `test_incident_dual_state_verification_success`).
  - [x] Full test suite of 67/67 automated pytest tests passing with 100% success rate across all 8 test suites.
  - [x] Frontend builds with 0 errors (`npm run build`).

---

### Phase 9: Unified Regression Protection & CI Foundation (COMPLETED)
- **Scope:**
  - Unify the outputs of Test Gap Discovery (AST mutation testing) and Incident-to-Regression workflows into a single regression protection system.
  - Test Library:
    - Searchable test catalog with live filtering.
    - Multi-dimensional grouping by project, repository, branch, commit SHA, source incident, and test type (`mutation_killer`, `incident_regression`, `boundary_check`, `invariant_protection`).
    - Normalized duplicate code hash detection (`compute_code_hash`) across whitespace and comment variations.
    - Test review and approval workflow (`pending_review`, `approved`, `rejected`) with authenticated reviewer audit attribution.
    - Ephemeral sandbox test execution recording stdout, stderr, exit codes, and immutable SHA-256 evidence digests.
    - Download and export of individual test cases (`.py`) and consolidated project regression suites.
    - Tracking of resolved and unresolved test gaps.
  - Execution Runs:
    - Track execution runs with Run ID, repository, commit SHA, trigger source (`manual`, `github_actions`, `webhook`), duration, and start/completion timestamps.
    - Granular breakdown of tests passed, failed, skipped, and blocked counts.
    - Server-side sorting, filtering, and pagination (`ExecutionRunListResponse`).
    - Associated test case IDs and finding links.
  - Reporting & Grounded Insights:
    - Unified reporting aggregating mutation effectiveness, surviving mutations, test generation stats, execution history, and recurring incidents.
    - Direct CSV and JSON export downloads (`/api/v1/reports/export`).
    - Grounded AI test intelligence: every insight links to concrete empirical evidence (AST node, mutant ID, or stack frame), provides quantitative uncertainty scores (`0.0`–`1.0`) and sandbox verification states (`verified_in_sandbox`), accompanied by explicit calibration disclaimers (never uncalibrated confidence claims).
  - Extensible CI Contract & Pipeline Integration:
    - Standardized CI contract (`/api/v1/ci/contract`) clearly distinguishing functional (GitHub Actions) from planned (GitLab CI, Jenkins, CircleCI) integrations.
    - Automated GitHub Actions workflow template generation (`/api/v1/ci/workflow-template`).
    - Authenticated CI runner trigger endpoint (`POST /api/v1/ci/runs`) accepting `X-TestBlind-Token` or Bearer JWT credentials.
  - Strict Tenant Scoping & Security:
    - All test cases, execution runs, reports, and CI triggers are strictly tenant-scoped and RBAC-controlled.
  - Code Hygiene & Zero Warnings:
    - Resolved Starlette 0.38+ deprecation warning by adopting RFC 9110 standard `HTTP_422_UNPROCESSABLE_CONTENT`.
- **Acceptance Criteria:**
  - [x] CodeLab empty input returns HTTP 422 with zero Starlette deprecation warnings (`test_codelab_warning_resolved`).
  - [x] Duplicate test detection catches identical normalized logic regardless of whitespace and comments (`test_duplicate_test_detection`).
  - [x] Saving a generated test with incident provenance and running it in an isolated sandbox records stdout, stderr, and evidence hash (`test_save_and_run_cataloged_test_in_sandbox`).
  - [x] Test review and approval workflow correctly transitions states with reviewer attribution (`test_test_case_review_and_approval_workflow`).
  - [x] Test catalog supports filtering by type/status and multi-field grouping (`test_test_cases_filtering_and_grouping`).
  - [x] Execution runs support sorting, filtering, and pagination (`test_execution_runs_filtering_sorting_and_pagination`).
  - [x] Unified reports aggregate mutation and incident telemetry and export valid CSV and JSON (`test_unified_reports_and_csv_json_export`).
  - [x] AI insights provide empirical evidence, uncertainty metrics, and calibration disclaimers (`test_ai_insights_evidence_and_uncertainty`).
  - [x] CI contract exposes functional GitHub Actions and planned systems; CI run trigger accepts `X-TestBlind-Token` (`test_ci_contract_and_run_trigger`).
  - [x] Tenant isolation prevents cross-tenant access to test cases, execution runs, and reports (`test_tenant_isolation_unified_regression`).
  - [x] Full test suite of 77/77 automated pytest tests passing with 100% success rate and 0 warnings.
  - [x] Frontend builds cleanly with 0 TypeScript / bundling errors (`npm run build`).

---

### Phase 10: Production Hardening, Load Testing & General Availability (PLANNED)
- **Scope:**
  - Penetration testing of container sandbox (fork bombs, privilege escalation, tmpfs exhaustion).
  - Load testing with Locust / k6 simulating 100+ concurrent sandbox executions.
  - End-to-end Cypress/Playwright automated test suite for the web UI.
  - Final reconciliation of all documentation against the codebase.
- **Acceptance Criteria:**
  - [ ] Zero critical or high vulnerabilities in container isolation audit.
  - [ ] API maintains P95 latency < 120ms under 50 req/sec load.
  - [ ] 100% of automated E2E user flows pass reliably.


