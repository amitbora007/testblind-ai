# TestBlind AI — Technical Architecture & System Design

**Document Version:** 1.0.0
**Status:** Approved Architectural Baseline
**Architecture Classification:** Distributed Event-Driven Microservices / Sandboxed SaaS

---

## 1. System Overview & Architecture Topology

TestBlind AI is architected with strict separation between the **Control Plane** (user management, API, orchestrator, state storage) and the **Execution Plane** (isolated, untrusted runner containers). Under no circumstances is arbitrary user repository code or generated test suites executed inside the Control Plane.

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Presentation Layer"]
        WebUI["Web Application (React + Vite + Tailwind)"]
        CLI["Local CLI Client (testblind-cli)"]
        CI["CI/CD Webhooks & GitHub Actions"]
    end

    subgraph IngressLayer ["Ingress & Gateway Layer"]
        Nginx["Reverse Proxy / SSL / Rate Limiter"]
    end

    subgraph ControlPlane ["Control Plane (Stateless FastAPI Tier)"]
        API["FastAPI Control Service"]
        AuthSvc["Auth & Tenant RBAC Service"]
        Orchestrator["Test Orchestration Engine"]
        LLMOrchestrator["LLM Prompt & Synthesis Engine"]
        WSGateway["WebSocket Live Log Gateway"]
    end

    subgraph StateAndQueues ["Persistence & Message Broker Tier"]
        PG[(PostgreSQL 16 + pgvector)]
        RedisCache[(Redis 7: Broker & Ephemeral State)]
        S3Blob[(Object Storage / S3 / MinIO)]
    end

    subgraph WorkerPool ["Async Worker Fleet (Celery / Arq)"]
        StaticWorker["Static & AST Analysis Worker"]
        MutationWorker["Mutation Generation Worker"]
        TriageWorker["Incident Log Triage Worker"]
        Synthesizer["AI Test Generation Worker"]
    end

    subgraph ExecutionPlane ["Execution Plane (Hardened Isolated Sandboxes)"]
        DockerDaemon["Container Runner Manager"]
        Sandbox1["Ephemeral Sandbox 1 (Docker/gVisor - Python)"]
        Sandbox2["Ephemeral Sandbox 2 (Docker/gVisor - Node.js)"]
        Sandbox3["Ephemeral Sandbox N (Docker/gVisor - Go/Java)"]
    end

    WebUI -->|HTTPS / WSS| Nginx
    CLI -->|REST API| Nginx
    CI -->|Webhook / API| Nginx

    Nginx --> API
    Nginx --> WSGateway

    API --> AuthSvc
    API --> Orchestrator
    API --> PG
    API --> RedisCache

    Orchestrator --> RedisCache
    LLMOrchestrator --> RedisCache

    RedisCache --> WorkerPool

    WorkerPool --> PG
    WorkerPool --> S3Blob
    WorkerPool --> LLMOrchestrator

    WorkerPool -->|Execute Test Jobs| DockerDaemon
    DockerDaemon --> Sandbox1
    DockerDaemon --> Sandbox2
    DockerDaemon --> Sandbox3

    Sandbox1 -->|Stream Stdout/Stderr| RedisCache
    RedisCache -->|Pub/Sub| WSGateway
    WSGateway -->|Stream Logs| WebUI
```

---

## 2. Technology Stack & Component Justifications

| Tier | Selected Technology | Version | Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React + TypeScript + Vite | React 19, TS 5.4, Vite 5 | High performance, rapid hot-reloading, type safety, rich component ecosystem for developer tooling. |
| **Styling & Design System** | Tailwind CSS + Lucide Icons | Tailwind v3.4+, Lucide React | Implements custom Dark TraceAI Studio design tokens, high density, accessible, zero runtime CSS overhead. |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | Latest | Production-grade IDE editor supporting syntax highlighting, side-by-side diffing, AST range markers, multi-language support. |
| **Data Visualizations** | Recharts / SVG Canvas | Latest | Renders stacked bar charts, donut gauges, sparklines, and execution timelines responsive to dark mode palette. |
| **Backend API** | Python + FastAPI | Python 3.12+, FastAPI 0.111+ | Native asynchronous ASGI performance, automatic OpenAPI 3.1 documentation, tight integration with Python AST/mutation engines and AI SDKs. |
| **Data Validation** | Pydantic v2 | v2.7+ | Ultra-fast Rust-based data validation and serialization for API contracts and LLM structured JSON output. |
| **Relational Database** | PostgreSQL + pgvector | PostgreSQL 16 | ACID transactions, robust JSONB querying for execution artifacts, relational integrity for multi-tenancy, vector similarity for incident logs. |
| **ORM & Migrations** | SQLAlchemy (Async) + Alembic | v2.0+, Alembic 1.13+ | Modern async session management with declarative mapped models and version-controlled database migrations. |
| **Cache & Task Broker** | Redis | Redis 7.2+ Alpine | High-throughput in-memory message broker for async task distribution, distributed locking, and WebSocket pub/sub streaming. |
| **Async Task Workers** | Celery / Arq | Celery 5.4+ / Arq | Distributed background task execution with automatic retries, concurrency limits, and scheduled heartbeat monitoring. |
| **Container Sandboxing** | Docker Engine API / gVisor | Docker 26+, runsc | Ephemeral runner containers with complete process, filesystem, and network isolation for executing untrusted user code. |
| **Object Storage** | MinIO (local dev) / AWS S3 (prod) | S3 API compatible | Scalable storage for raw repository ZIP archives, execution logs, and coverage reports. |

---

## 3. Sandboxed Untrusted Code Execution Engine

### 3.1 The Untrusted Execution Threat Model
Executing user repositories, external dependencies, and AI-generated test code introduces severe security risks:
1. Malicious dependency execution (e.g. `npm install` post-install scripts or `setup.py` hooks).
2. Host container breakout or Linux kernel privilege escalation.
3. Cryptomining or resource starvation (fork bombs, CPU loops, memory exhaustion).
4. SSRF attacks against internal infrastructure or cloud metadata endpoints (`169.254.169.254`).
5. Host filesystem compromise or lateral network movement.

### 3.2 Sandbox Hardening & Defense-in-Depth Specification
Every test run or mutation execution is encapsulated inside an ephemeral container configured with the following restrictions:

```
┌────────────────────────────────────────────────────────┐
│ Hardened Ephemeral Runner Container                     │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Read-Only Root Filesystem (/): No persistent writes│ │
│ │ Dedicated Tmpfs (/tmp, /workspace): Max 100MB RAM  │ │
│ │ User Context: Non-root 'runner' (UID 10001, GID 10001)│
│ │ Dropped Capabilities: ALL capabilities dropped     │ │
│ │ Security Profile: seccomp=default, apparmor=docker-default
│ │ Runtime: runsc (gVisor) in production / isolated runc│
│ ├────────────────────────────────────────────────────┤ │
│ │ Network Isolation:                                 │ │
│ │   Mode: --network=none                             │ │
│ │   Optional Egress: Strictly via controlled egress  │ │
│ │   proxy with domain whitelist for dependency fetch │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Resource Quotas:                                   │ │
│ │   CPU Limit: 1.0 Core (cpus=1.0)                   │ │
│ │   Memory Limit: 1024MB (memory=1024m, swap=0)      │ │
│ │   PIDs Limit: 128 processes (pids-limit=128)       │ │
│ │   Execution Timeout: 60s hard kill via daemon      │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 3.3 Container Lifecycle Flow
1. **Runner Provisioning:** Worker requests a pre-warmed language-specific runner image (`testblind-runner-python:3.12`, `testblind-runner-node:20`).
2. **Mounting Ephemeral Context:** The tenant's code snapshot is mounted into a dedicated tmpfs scratch volume (`/workspace`) with read-write access restricted to the non-root runner user.
3. **Execution Command Injection:** The target execution command (e.g. `pytest --tb=short tests/test_generated_repro.py`) is invoked with strict timeout enforcement (`timeout 60s`).
4. **Log Interception & Streaming:** Stdout and Stderr are intercepted frame-by-frame, published to Redis Pub/Sub channels for live client WebSocket playback, and aggregated for analysis.
5. **Teardown & Purge:** Container is forcefully terminated (`docker rm -f`) and the temporary workspace directory is securely purged.

### 3.4 Safe Archive Ingestion & Path Traversal (Zip Slip) Defense
Uploaded ZIP archives from untrusted users present critical path traversal attack vectors. TestBlind AI enforces three defense-in-depth layers inside `SafeArchiveExtractor`:
1. **Magic Byte Signature Verification:** Verifies standard ZIP header signatures (`PK\x03\x04` or `PK\x05\x06`). Renamed executable binaries (`.exe`, `.elf`, `.so`, scripts) are rejected with `HTTP 400 Bad Request`.
2. **Zip Slip Canonical Path Traversal Defense:** Each archive member's normalized target path is tested using `os.path.commonpath([dest_dir, target_path]) == dest_dir`. Any relative directory traversal (`../../../../etc/passwd`), absolute path (`/etc/shadow`), or symlink pointing outside the tenant destination directory is aborted immediately with a security alert.
3. **Zip Bomb Mitigation:** Archives with uncompressed sizes exceeding 500MB, compression ratios exceeding 100:1, or containing more than 10,000 files are rejected.

### 3.5 Standalone Code Lab Sandbox & Evidence Sealing
The Code Lab enables instant AST mutation testing without requiring a repository connection.
- **AST Parser:** Analyzes Python AST (`ast.parse`) or TypeScript syntax trees to isolate function definitions, branch nodes, and relational comparison operators (`ROR`: `<`, `<=`, `>`, `>=`, `==`, `!=`).
- **Semantic Demarcation:** Clearly separates **source-only AI proposals** (`is_executable: false`) from **verified execution evidence** (`is_executable: true`).
- **Cryptographic Evidence Sealing:** Successful sandbox executions compute a SHA-256 evidence hash of `source_code + test_code + stdout + exit_code`, ensuring immutable provenance.

### 3.6 Local CLI Companion (`testblind-cli`) Architecture
For enterprise teams prohibited from uploading proprietary source code to cloud services, the local companion CLI (`testblind scan`) executes AST parsing on the developer machine:
- Transmits only anonymized AST metadata hashes and mutation signatures to the Control Plane.
- Zero source code bytes leave the local developer workstation.

### 3.7 Background Queue & Bounded Worker Fleet Architecture
To safely decouple untrusted execution from FastAPI request handlers:
- **`JobQueueEngine` (`app/services/queue_service.py`):**
  - Asynchronous background queue engine supporting configurable bounded worker capacity (`MAX_CONCURRENT_WORKERS = 4`).
  - **Per-Tenant Concurrency Quota:** Restricts each organization to a maximum number of concurrent running executions (`MAX_TENANT_CONCURRENT_RUNS = 2`), preventing resource monopolization.
  - **Idempotency Control:** Submissions with an `idempotency_key` deduplicate against active in-flight runs, returning the existing job record to prevent duplicate container allocations.
  - **Job Cancellation & Tree Termination:** Calling `POST /api/v1/execution-runs/{id}/cancel` triggers an asynchronous cancellation event that issues `os.killpg(pgid, signal.SIGKILL)` on the sandbox process group, immediately releasing worker capacity.
  - **Exponential Backoff Retries:** Transient worker/system failures trigger exponential backoff retry cycles up to `max_retries = 2`.
  - **Graceful Lifecycle Management:** FastAPI lifespan hooks automatically drain and cancel workers on shutdown and reconcile orphaned state on startup.

### 3.8 Dual-Driver Sandbox & Secret Scrubbing Specification
Untrusted repository test execution and mutation analysis use a pluggable isolation model:
1. **`EnvironmentScrubber`:**
   - Strips all host environment variables matching `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `DATABASE`, `POSTGRES`, `JWT`, `AWS`, `MINIO`, `GITHUB`, `AUTH`.
   - Passes only safe minimal baseline keys (`PATH`, `LANG`, `TMPDIR`, and runtime-safe flags).
2. **`HardenedSubprocessDriver`:**
   - Employs POSIX kernel limits via `resource.setrlimit` in `preexec_fn`:
     - `RLIMIT_CPU`: Enforces hard CPU execution timeout.
     - `RLIMIT_AS`: Virtual address space cap (512MB default).
     - `RLIMIT_NPROC`: Limits maximum processes/threads to 64 to thwart fork bombs.
     - `RLIMIT_FSIZE`: Caps maximum written file size to 20MB to prevent disk exhaustion.
   - Process group isolation via `os.setsid()` ensures all subprocess children are terminated together.
   - Output buffer protection: caps stdout/stderr to 1MB per stream to prevent memory exhaustion attacks.
   - Ephemeral scratch isolation: workspaces (`/tmp/testblind_sandboxes/run_<uuid>`) are created disposable and deleted in guaranteed `finally:` blocks.
3. **`DockerSandboxDriver`:**
   - Detects Docker daemon availability. Configures ephemeral containers with `--read-only`, `--network=none`, unprivileged non-root user (`UID 10001`), and memory/CPU limits. Automatically falls back to the hardened POSIX driver when the Docker daemon is restricted or unprivileged.

---

## 4. Database Schema & Entity Architecture

```mermaid
erDiagram
    ORGANIZATION ||--o{ WORKSPACE : contains
    ORGANIZATION ||--o{ USER_MEMBERSHIP : has
    USER ||--o{ USER_MEMBERSHIP : belongs_to

    WORKSPACE ||--o{ PROJECT : contains
    PROJECT ||--o{ REPOSITORY : tracks
    PROJECT ||--o{ TEST_SUITE : organizes
    PROJECT ||--o{ INCIDENT : tracks

    TEST_SUITE ||--o{ TEST_CASE : groups
    TEST_CASE ||--o{ TEST_SCENARIO_MEMBER : includes
    TEST_SCENARIO ||--o{ TEST_SCENARIO_MEMBER : references

    PROJECT ||--o{ EXECUTION_RUN : executes
    EXECUTION_RUN ||--o{ RUN_STEP : contains
    EXECUTION_RUN ||--o{ MUTATION_RESULT : produces

    INCIDENT ||--o{ REPRO_TEST_LINK : associates
    TEST_CASE ||--o{ REPRO_TEST_LINK : provides_regression
```

### 4.1 Implemented PostgreSQL Schema (16 Relational Tables)
The database tier is implemented with PostgreSQL 16, SQLAlchemy 2.0 async ORM, and version-controlled via Alembic migrations (`backend/alembic/versions/001_initial_schema.py`):

1. **`organizations`**: Multi-tenant enterprise boundary (`id`, `name`, `slug`, `billing_tier`, `created_at`, `updated_at`).
2. **`users`**: Global user identities (`id`, `email`, `hashed_password`, `full_name`, `is_active`, `is_superuser`, timestamps).
3. **`user_memberships`**: Tenant-scoped membership mapping users to organizations with assigned role (`owner`, `admin`, `engineer`, `viewer`).
4. **`projects`**: Organization-owned projects (`id`, `organization_id`, `name`, `key`, `description`, timestamps).
5. **`repositories`**: Connected GitHub/GitLab repositories or uploaded ZIP bundles (`id`, `project_id`, `provider`, `repo_url`, `default_branch`, `auth_token_secret_ref`, `is_active`).
6. **`scan_jobs`**: AST mutation and gap discovery scan jobs (`id`, `project_id`, `status`, `target_branch`, `commit_sha`, `summary_metrics`).
7. **`findings`**: Semantic gap findings uncovered during AST scans (`id`, `scan_id`, `file_path`, `line_number`, `severity`, `finding_type`, `description`).
8. **`mutations`**: Injected code mutations (`id`, `scan_id`, `finding_id`, `file_path`, `line_number`, `operator`, `original_code`, `mutated_code`, `status`: `KILLED`, `SURVIVED`, `TIMED_OUT`, `ERROR`).
9. **`test_cases`**: Cataloged unit and regression tests (`id`, `project_id`, `title`, `file_path`, `code`, `language`, `status`: `AI_SUGGESTED`, `VERIFIED_EXECUTED`, `EXECUTION_FAILED`, `execution_hash`).
10. **`test_scenarios`**: Multi-step integration suites mapped to product requirements (`id`, `project_id`, `name`, `requirement_code`, `description`, `is_active`).
11. **`test_scenario_members`**: Ordered steps linking test cases to scenarios (`scenario_id`, `test_case_id`, `step_order`).
12. **`execution_runs`**: Ephemeral container execution records (`id`, `project_id`, `trigger_type`, `status`, `exit_code`, `duration_seconds`, `logs`, `runner_metadata`).
13. **`run_steps`**: Granular execution steps within a run (`id`, `run_id`, `step_order`, `name`, `command`, `exit_code`, `stdout`, `stderr`, `duration_ms`).
14. **`incidents`**: Production failure intake (`id`, `project_id`, `title`, `severity`, `raw_stack_trace`, `logs`, `faulting_module`, `faulting_line`, `reproduction_state`: `INTAKE`, `REPRODUCED_BUGGY`, `PATCH_VERIFIED`, `PROMOTED`, `generated_test_id`).
15. **`integration_settings`**: Third-party provider configs (`id`, `organization_id`, `provider`, `config_json`, `is_active`).
16. **`audit_events`**: Immutable audit logs (`id`, `organization_id`, `user_id`, `action`, `resource_type`, `resource_id`, `metadata_json`).

### 4.2 Multi-Tenant Isolation & Server-Side RBAC Architecture
- **Tenant Context Verification (`get_tenant_context`):**
  - Clients provide the active tenant context via `X-Organization-ID` header.
  - The API **never trusts** client-provided tenant identifiers blindly.
  - For every protected request, `get_tenant_context` validates that the authenticated `current_user` holds an active record in `user_memberships` for that specific `organization_id`.
  - Forged tenant headers or attempts to access another organization's workspace immediately abort with `HTTP 403 Forbidden`.
- **Cross-Tenant Data Scoping:**
  - All project, repository, scan job, incident, test case, and execution queries filter strictly on tenant-scoped foreign keys (`organization_id` or `project.organization_id == tenant.organization.id`).
  - Access to resources belonging to other organizations returns `HTTP 404 Not Found` (or `403 Forbidden`), preventing metadata leakage.
- **Hierarchical RBAC Enforcement (`require_role`):**
  - Roles follow a strict privilege hierarchy: `owner` (40) > `admin` (30) > `engineer` (20) > `viewer` (10).
  - `viewer`: Read-only access to dashboards, test suites, reports, and execution logs.
  - `engineer`: Can create projects, link repos, trigger scans, create test cases/scenarios, and intake incidents.
  - `admin`: Can configure integrations, manage organization settings, and invite team members.
  - `owner`: Full administrative control including organization deletion and billing management.

---

## 5. AI Test Generation & Mutation Pipeline Architecture

### 5.1 AST Analysis & Mutation Engine
- **Python AST Engine:** Built using standard library `ast` module and `libcst` for concrete syntax tree modification and token preservation.
- **TypeScript/JavaScript:** Built using `@babel/parser`, `@babel/traverse`, and `@babel/generator`.
- **AST Operator Families (`mutation_engine.py`):**
  - `ROR` (Relational Operator Replacement): Inverts or shifts comparison operators (`>`, `<`, `>=`, `<=`, `==`, `!=`, `in`, `not in`, `is`, `is not`).
  - `AOR` (Arithmetic Operator Replacement): Replaces arithmetic operators with adjacent alternatives (`+`, `-`, `*`, `/`, `//`, `%`, `**`).
  - `LCR` (Logical Connector Replacement): Inverts boolean logic connectives (`and` $\leftrightarrow$ `or`, and `not` inversions).
  - `BSR` (Boundary Shift Replacement): Injects off-by-one shifts on boundary conditions (e.g. integer thresholds `+1`/`-1`, and boolean constant toggles `True` $\leftrightarrow$ `False`).
- **AST Validation & Equivalence Filtering:**
  - Every mutant is compiled in-memory via `compile(mutated_ast, '<mutant>', 'exec')`. Mutants producing compilation errors are marked `status="invalid"` and excluded from scoring denominators.
  - Heuristic detection flags mutations yielding logically identical bytecode or unprovable conditions as `status="equivalent"`.
- **Mutation Score Formula:**
  $$\text{Mutation Score} = \left(\frac{\text{Killed Mutants}}{\text{Total Mutants} - \text{Equivalent} - \text{Invalid}}\right) \times 100\%$$

### 5.2 Test Impact Analysis (TIA) Engine
To eliminate the $O(M \times T)$ combinatorial compute explosion in mutation testing across large multi-module repositories, the mutation executor leverages the `TestImpactAnalyzer` (`app/services/impact_analysis.py`):
- **Static Import Dependency Graph:** Analyzes Python AST import statements (`ast.Import`, `ast.ImportFrom`) across all test suites to construct a mapping of `source_module -> [test_file_paths]`.
- **Targeted Test Execution:** During each mutant evaluation, only test suites that import or exercise the mutated source module are executed inside the ephemeral sandbox runner.
- **Graceful Fallback:** If static analysis detects dynamic imports (`importlib`) or cannot map a module, the executor safely falls back to executing the full test directory.
- **Impact Ratio & Acceleration:** Reduces total execution time by up to 80-90% on repositories with partitioned unit test suites.

### 5.3 Multi-Provider LLM Orchestration & Static Anti-Tautology AST Auditor

The AI Synthesis Engine (`app/services/llm_service.py`) orchestrates test synthesis with multi-tier cloud LLM providers, strict anti-tautology AST auditing, and local deterministic fallback:

```
┌────────────────────────────────────────────────────────┐
│ Target Context Assembly:                               │
│  - Mutated Source Code & Survived AST Operator         │
│  - Existing Passing Test Fixtures & Enterprise Mocks   │
│  - Boundary Thresholds & Comparison Operators          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Multi-Provider Async LLM Dispatch (httpx async client): │
│  - Anthropic: claude-3-5-sonnet-20241022               │
│  - OpenAI: gpt-4o                                      │
│  - Google Gemini: gemini-1.5-pro                       │
│  (Configured via DEFAULT_LLM_PROVIDER in .env)         │
└──────────────────────────┬─────────────────────────────┘
                           │ (On API timeout / failure)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Upgraded Local AST Synthesizer (Zero-Latency Fallback):│
│  - AST boundary extraction (_extract_comparison_thresh)│
│  - Invariant assertion synthesis (concrete values)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ ASTAssertionAuditor (Strict Anti-Tautology Gatekeeper):│
│  - Rejects empty test code or syntax errors            │
│  - Rejects zero-assertion test functions               │
│  - Strictly bans vacuous assertions:                   │
│      * assert True / assert not False                  │
│      * assert x is not None or x is None               │
│      * assert x or True / assert True or x             │
│      * assert 1 == 1 / assert 'a' == 'a'               │
│      * assert e is not None or True                    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Dual-State Sandbox Execution Gate:                     │
│  - Gate 1 (Pristine Unmutated): MUST PASS (exit 0)     │
│  - Gate 2 (Mutated Codebase):   MUST FAIL (exit != 0)  │
│  - Outcome: Promoted to VERIFIED with SHA-256 evidence │
└────────────────────────────────────────────────────────┘
```

#### 1. Zero-Bloat Cloud Provider Dispatch
LLM calls utilize native HTTP JSON APIs via `httpx.AsyncClient` with strict timeouts (`LLM_TIMEOUT_SECONDS=30`) and token quotas, avoiding heavy external SDK dependencies and vendor lock-in.

#### 2. The Anti-Tautology AST Auditor (`ASTAssertionAuditor`)
Every synthesized test is parsed into a Python AST before execution:
- Traverses all `ast.Assert` statements and validates assertion test nodes.
- Inspects `ast.BoolOp` (`or` / `and`) and binary comparisons (`ast.Compare`) for tautological patterns.
- Validates that the test contains at least one meaningful assertion or `pytest.raises` block exercising the domain logic.

### 5.4 Incident-to-Regression Pipeline, Webhooks & Git Patch Export

#### 1. Ingestion & Automated Secret/PII Sanitization
The incident intake subsystem sanitizes all unstructured log and stack trace payloads before database storage or LLM prompt dispatch (`app/core/sanitization.py`):
- **Credential Stripping:** Automatically matches and redacts AWS access keys (`AKIA...`), GitHub tokens (`ghp_...`, `github_pat_...`), GitLab tokens (`glpat-...`), TestBlind tokens (`tb_live_...`), and Bearer JWTs (`eyJ...`).
- **Database Connection URIs:** Strips plaintext passwords from connection strings (`postgresql://user:pass@host/db`).
- **PII Scrubbing:** Replaces credit card patterns and email addresses with high-visibility redaction markers (`[REDACTED_...]`).

#### 2. Automated Incident Webhooks
Production alerting platforms connect directly to TestBlind via authenticated webhooks:
- `POST /api/v1/incidents/webhook/sentry`: Ingests Sentry error alerts, extracting project slug, issue title, culprit frame, exception values, and sanitized stack traceframes.
- `POST /api/v1/incidents/webhook/generic`: Ingests alerts from Datadog, PagerDuty, or custom logging collectors.

#### 3. Traceback Parsing & Fault Anchor Mapping
The parser decomposes Python and Node.js tracebacks into structured `StackFrame` objects:
- Identifies the root fault anchor (deepest application frame, file path, line number, and function).
- Extracts exception type (`ZeroDivisionError`, `KeyError`, `IndexError`, `TypeError`) and failure message.

#### 4. Context Adequacy & Anti-Hallucination Guardrails
To prevent synthetic hallucinations:
- If source code for the faulting module is missing, the incident is assigned status `needs_more_info`. The engine explicitly catalogs missing context in `missing_details` and assigns high uncertainty (`uncertainty_score >= 0.85`).
- The system **never claims** to have reproduced an incident or synthesized a test without verifiable source code.

#### 5. Dual-State Sandbox Verification Protocol
When buggy code and candidate tests are available, `IncidentAnalysisService.verify_dual_state` executes a two-state proof in an airgapped sandbox:
- **State A (Buggy Codebase):** The candidate test **MUST FAIL** (`exit_code != 0`), reproducing the reported exception signature.
- **State B (Corrected Codebase):** When fix code is supplied, the test **MUST PASS** (`exit_code == 0`) cleanly.
- **Evidence Sealing:** Dual-state execution stdout, stderr, and exit codes are hashed into an immutable 64-character SHA-256 evidence digest.

#### 6. One-Click Git Patch & GitHub PR Export
Developers can instantly export verified incident reproduction tests into their team's Git workflows:
- `POST /api/v1/incidents/{id}/export-patch`: Generates a standard unified Git diff (`.patch`), file name, formatted PR title (`fix(regression): add repro test for <incident>`), and a structured markdown PR body containing verification evidence, root cause hypothesis, and traceback.
- `GET /api/v1/incidents/{id}/export-patch.diff`: Streams the raw unified Git diff directly for `git apply <patch>` integration.
- `POST /api/v1/incidents/{id}/promote`: Promotes verified tests directly into the permanent `test_cases` library.

### 5.5 Unified Regression Protection Architecture

#### 1. Unified Test Library & Multi-Dimensional Grouping
Combines outputs from Test Gap Discovery (AST mutation testing) and Incident-to-Regression pipelines into an immutable regression catalog:
- **Grouping Dimensions:** Supports dynamic categorization by `repository`, `branch`, `commit_sha`, `source_incident_id`, and `test_type` (`mutation_killer`, `incident_regression`, `boundary_check`, `invariant_protection`).
- **Normalized Duplicate Detection:** Computes whitespace- and comment-invariant SHA-256 code hashes (`RegressionService.compute_code_hash`) across existing test cases within the tenant project to prevent redundant test generation.
- **Review & Approval Gateways:** Tests support lifecycle states (`pending_review`, `approved`, `rejected`) with authenticated reviewer audit attribution and timestamps.
- **Cryptographic Evidence Sealing:** Execution outputs, exit codes, and timestamps are sealed into a SHA-256 evidence digest (`evidence_hash`) with historical execution telemetry stored in JSONB.
- **Export & Portability:** Single test downloads (`.py`) and consolidated project regression suites are exportable on demand.

#### 2. Execution Runs & Telemetry
Tracks end-to-end execution runs with comprehensive telemetry:
- **Run Metadata:** Stores run ID, branch, commit SHA, trigger source (`manual`, `github_actions`, `webhook`, `scheduled`), timestamps, duration in ms, and step logs.
- **Metrics Breakdown:** Records tests passed, failed, skipped, and blocked counts.
- **Finding & Test Association:** Relates execution runs to generated test cases and identified gaps.
- **Pagination & Sorting:** Server-side sorting (`created_at`, `duration_ms`) and paginated listings.

#### 3. Grounded AI Insights & Uncertainty Calibration
- **Empirical Evidence Anchors:** Every generated insight links to concrete AST nodes, mutation IDs, or stack trace frames.
- **Uncertainty Quantification:** Quantitative scores (`0.0`–`1.0`), factor explanations, and sandbox verification states (`verified_in_sandbox`).
- **Calibration Disclaimers:** All insights explicitly declare that confidence values reflect heuristic risk indicators and empirical sandbox proofs, **never uncalibrated probabilistic claims**.

#### 4. Extensible CI Contract & Pipeline Integration
- **Standardized CI Contract (`/api/v1/ci/contract`):** Extensible specification for CI integrations. GitHub Actions is fully functional; GitLab CI, Jenkins, and CircleCI are clearly labeled as planned.
- **GitHub Actions Workflow Generation (`/api/v1/ci/workflow-template`):** Auto-generates ready-to-run GitHub Actions workflow definitions configured for automated PR status checks.
- **CI Webhook Trigger (`POST /api/v1/ci/runs`):** Accepts runner authentication via `X-TestBlind-Token` header or Bearer JWT, executes regression suites, and returns structured check summaries.

---

## 6. API Design & Communication Protocols

### 6.1 RESTful Control Plane (OpenAPI 3.1)
- `/api/v1/auth`: Login, registration, token refresh, OAuth callback.
- `/api/v1/organizations`: Organization settings, member management, invite tokens.
- `/api/v1/projects`: Project CRUD, repository linking, branch listings.
- `/api/v1/repositories/upload-zip`: Multipart ZIP archive upload endpoint.
- `/api/v1/playground/execute`: Ad-hoc code + test evaluation in sub-second sandbox.
- `/api/v1/mutation-runs`: Initiate AST analysis and mutation gap discovery.
- `/api/v1/incidents`: Submit incident reports, parse stack traces, trigger reproduction generation.
- `/api/v1/test-cases`: Searchable test library, multi-field grouping, duplicate check, review approval, sandbox test runner, and single/suite exports.
- `/api/v1/execution-runs`: Execution run telemetry, filtering, sorting, pagination, and real-time logs.
- `/api/v1/reports`: Unified regression reporting and CSV/JSON export endpoints.
- `/api/v1/ai-insights`: Grounded AI test intelligence with empirical evidence and calibrated uncertainty metrics.
- `/api/v1/ci`: Extensible CI contract, GitHub Actions workflow template, and authenticated CI run triggers.
- `/api/v1/dashboard/metrics`: Aggregated KPI counters, coverage ratios, weekly status bars.

### 6.2 Real-time WebSocket Protocol
- Route: `/ws/v1/runs/{run_id}/stream`
- Authentication: Short-lived WebSocket ticket exchange via HTTP query parameter.
- Message Format (JSON):
```json
{
  "event": "log_chunk",
  "data": {
    "step_id": "step_mut_04",
    "stream": "stdout",
    "timestamp": "2026-10-26T11:20:00.123Z",
    "text": "running pytest on mutated target: math_utils.py:42 [MUTANT: AOR_PLUS_TO_MINUS]... KILLED\n"
  }
}
```

---

## 7. Security, Compliance & Data Governance

1. **Multi-Tenant Isolation:**
   - Every database query enforces tenant isolation via SQLAlchemy query filters (`where organization_id == current_org`).
   - S3 storage buckets partition objects by `org_{id}/proj_{id}/`.
2. **Credential Storage:**
   - All external secrets (GitHub personal access tokens, webhook secrets, custom API keys) are encrypted using AES-256-GCM with envelope encryption via a master key rotation system.
3. **Audit Logging:**
   - All user actions (test execution, incident intake, member invitation, code download) are logged into an append-only audit trail table with actor ID, IP address, timestamp, and payload hash.
