# TestBlind AI — Phased Implementation Plan & Acceptance Criteria

**Document Version:** 1.1.0  
**Status:** Approved Master Roadmap  
**Current Phase:** Phase 3 (Frontend Screens & Workflows) — Completed  
**Next Phase:** Phase 4 (Core Data Models, Authentication & Multi-Tenancy)  

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
│ Phase 4: Sandboxed Untrusted Execution Engine [PLANNED]                     │
│ - Ephemeral container runners (Docker/gVisor), resource quotas, timeout     │
│ - Zero API execution enforcement, Redis pub/sub live log streaming          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5: AI Test Gap Discovery & Mutation Testing Pipeline [PLANNED]        │
│ - AST parser, operator mutation matrix (ROR, AOR, LCR, BSR)                 │
│ - Surviving mutant identification, LLM test synthesis & verification        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Incident-to-Regression Pipeline & Dual-State Verification [PLANNED]│
│ - Stacktrace/log parser, fault anchor mapping                               │
│ - Dual-state verification (reproduce on buggy, pass on fixed)               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 7: Standalone Code Playground & Local ZIP Ingestion [PLANNED]         │
│ - Multi-language Monaco code editor, sub-second sandbox execution           │
│ - Safe ZIP decompression with path traversal defense                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 8: Integrations & Local CLI (`testblind-cli`) [PLANNED]               │
│ - GitHub App & OAuth, webhook triggers, PR checks                           │
│ - Local CLI for on-prem enterprise execution without code upload            │
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
    - `/api/v1/integrations`: third-party tool configurations and CLI token issuance (`tb_live_...`).
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

### Phase 5: Incident-to-Regression Pipeline & Dual-State Verification (PLANNED)
- **Scope:**
  - Incident intake API accepting raw stack traces, logs, and commit references.
  - Stack trace parser extracting faulting frames, file paths, and line numbers.
  - PII / secret redaction filter stripping API keys and passwords before prompt dispatch.
  - Reproduction test synthesizer generating tests replicating the failure.
  - Dual-State Verification Engine:
    - Step A: Run test on buggy code -> Must FAIL with identical exception signature.
    - Step B: Run test on fixed code -> Must PASS with exit code 0.
  - Promotion to the unified regression test suite.
- **Acceptance Criteria:**
  - [ ] Pasting a Python ZeroDivisionError or IndexError stack trace extracts the exact faulting module and line.
  - [ ] The generated reproduction test fails on the buggy code snippet matching the incident error.
  - [ ] The test passes when run against the fixed code snippet.
  - [ ] The test is cataloged in the regression suite with an immutable incident link and execution evidence badge.

---

### Phase 6: Dark TraceAI Studio Dashboard & Web Application (PLANNED)
- **Scope:**
  - React 19 + TypeScript + Vite + Tailwind CSS frontend application.
  - Full implementation of the TraceAI Studio dark palette (`#0F172A`, `#1E293B`, `#334155`).
  - Top 4 KPI metric cards:
    - Test Cases Overview (Total, Automated/Manual, Automation Rate bar).
    - Requirement Coverage (Total, Covered/Untested, 92% circular gauge).
    - Test Scenarios Executed (Total, Passed/Failed, green sparkline).
    - AI-Driven Insights (Flaky count, Optimization count, glowing AI brain).
  - Main charts:
    - Weekly Execution Status stacked bar chart (Passed/Failed/Skipped/Blocked).
    - Requirement Coverage Analysis donut chart (60/25/10/5 breakdown).
  - Recent Test Scenarios table with scenario drawer, execution duration, and AI confidence badges.
  - Responsive layouts: desktop, tablet, and mobile.
- **Acceptance Criteria:**
  - [ ] Visual fidelity matches `references/aitool.jpeg` across layout, colors, typography, and card hierarchy.
  - [ ] Fully responsive down to 375px mobile without horizontal layout breakages.
  - [ ] Keyboard navigable with visible focus states and WCAG 2.1 AA compliant text contrast.
  - [ ] Interactive slide-over drawer shows detailed scenario step logs and verified evidence signatures.

---

### Phase 7: Standalone Code Playground & Local ZIP Ingestion (PLANNED)
- **Scope:**
  - Standalone Monaco code editor supporting Python, TypeScript, and Go.
  - Split editor view: Implementation code (left) vs Unit / Generated tests (right).
  - Quick action toolbar: "Inject Mutations", "Generate Test", "Run in Sandbox".
  - Sub-second execution sandbox returning stdout, stderr, execution duration, and mutation status.
  - Web UI drag-and-drop ZIP upload with progress bar and automatic project creation.
- **Acceptance Criteria:**
  - [ ] User can enter code in the playground without logging in or connecting a repository.
  - [ ] Clicking "Run in Sandbox" executes code in ephemeral container and returns results within 3 seconds.
  - [ ] Dragging and dropping a repository ZIP archive unpacks safely and populates project file tree.

---

### Phase 8: Integrations & Local CLI (`testblind-cli`) (PLANNED)
- **Scope:**
  - GitHub App integration for OAuth login, repository selection, and pull request checks.
  - GitHub Action workflow integration for CI-triggered test gap discovery.
  - Standalone `testblind-cli` tool for local developer machines:
    - Analyzes local repository without uploading proprietary source code.
    - Sends anonymized AST metadata and failure signatures to SaaS API.
    - Receives test proposals and executes them locally in developer's Docker daemon.
- **Acceptance Criteria:**
  - [ ] GitHub webhook on pull request triggers mutation analysis and posts check summary with mutation score delta.
  - [ ] `testblind-cli run --local` executes mutation testing locally and displays formatted terminal table.

---

### Phase 9: Hardening, Security Audits, E2E Verification & Launch (PLANNED)
- **Scope:**
  - Penetration testing of container sandbox (fork bombs, privilege escalation, tmpfs exhaustion).
  - Load testing with Locust / k6 simulating 100+ concurrent sandbox executions.
  - End-to-end Cypress/Playwright automated test suite for the web UI.
  - Final reconciliation of all documentation against the codebase.
- **Acceptance Criteria:**
  - [ ] Zero critical or high vulnerabilities in container isolation audit.
  - [ ] API maintains P95 latency < 120ms under 50 req/sec load.
  - [ ] 100% of automated E2E user flows pass reliably.
