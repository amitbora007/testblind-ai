# TestBlind AI — Canonical Product Specification

**Document Version:** 1.0.0  
**Status:** Approved Architectural Baseline  
**Product Classification:** B2B Developer Tools / Automated Testing SaaS  
**Target Release:** Q3/Q4 Enterprise & Team Tier  

---

## 1. Executive Summary & Product Mission

Modern software development organizations face two critical testing crises:
1. **The Test Blindspot Crisis:** Standard line and branch coverage metrics create a false sense of security. Suites with >85% line coverage frequently fail to assert critical business invariants, leaving edge cases unverified and allowing breaking defects into production.
2. **The Incident Amputation Crisis:** When production incidents occur, engineers scramble to patch code and resolve post-mortems, but frequently fail to backport comprehensive, regression-proof reproduction tests. Future refactors silently reintroduce the same regression.

**TestBlind AI** is a professional AI-native software testing SaaS engineered to eliminate test blindspots and automate incident post-mortem test synthesis. By integrating **AST-driven mutation testing**, **LLM-powered test synthesis**, **containerized isolated execution**, and **dual-state verification**, TestBlind AI delivers verified, executable regression tests that harden applications against regressions.

---

## 2. Target Personas & Primary Use Cases

| Persona | Primary Needs & Pain Points | TestBlind AI Value Realization |
| :--- | :--- | :--- |
| **SDET / QA Architect** | Identifying surviving mutations, measuring true suite effectiveness beyond line coverage. | Automated mutation testing matrix, AI edge case synthesis, verified regression library. |
| **Senior Software Engineer** | Reproducing intricate production defects, writing comprehensive unit/integration tests without context fatigue. | Incident-to-Regression workflow: converts logs and tracebacks into reproducible tests in minutes. |
| **Engineering Manager / VP** | Reducing defect recurrence, tracking test ROI, auditing test coverage across repositories. | TraceAI Studio Dashboard, requirement coverage gauges, mutation score velocity, flakiness predictions. |
| **DevOps / Platform Engineer** | Secure execution of untrusted test code, automated CI/CD quality gates, zero credential leakage. | Sandboxed runner architecture, GitHub Actions integration, PR check runs with evidence gating. |

---

## 3. Core Product Workflows

### 3.1 Workflow 1: AI Test Gap Discovery & Mutation Testing

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Source Code &  │ ──> │ AST Analysis &   │ ──> │ Containerized       │
│  Existing Tests │     │ Mutation Matrix  │     │ Mutation Execution  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                            │
                                                            ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Verified Test   │ <── │ Isolated Sandbox │ <── │ AI Test Synthesis   │
│ Suite Promotion │     │ Test Execution   │     │ (Kills Survivors)   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

#### Detailed Workflow Steps:
1. **Target Selection:** User selects repository branch, directory path, or individual modules for analysis.
2. **Static & AST Analysis:**
   - Abstract Syntax Tree (AST) parsing of source code and test files.
   - Identification of cyclomatic complexity peaks, untested branch conditionals, edge-case parameters, and unexercised exception blocks.
3. **Mutation Generation Matrix:**
   - Systematic injection of semantic faults (mutants) across operators:
     - Relational (`<` to `<=`, `==` to `!=`)
     - Arithmetic (`+` to `-`, `*` to `/`)
     - Logical (`and` to `or`, `True` to `False`)
     - Return value substitutions (`return val` to `return None` / `return 0`)
     - Exception suppression or modification.
4. **Isolated Mutation Execution:**
   - Mutants are executed against existing test suites inside isolated container runners.
   - Mutants are classified as **KILLED** (existing tests failed as expected), **SURVIVED** (tests passed despite mutation — identifying a blindspot), or **TIMED OUT** (infinite loops).
5. **AI Edge-Case & Assertion Synthesis:**
   - Surviving mutants and AST gap reports are packaged into structured LLM prompts.
   - AI generates targeted, high-fidelity test cases explicitly tailored to kill surviving mutants.
6. **Execution Verification (Crucial Quality Gate):**
   - Synthesized tests are executed inside the isolated sandbox against both mutated and unmutated code.
   - If the new test kills the mutant AND passes on pristine code, it is classified as **Verified**.
   - If it fails on pristine code (hallucination or invalid setup), it is sent to auto-healing or rejected.
7. **Regression Suite Promotion:**
   - Verified tests are formatted as pull requests, downloadable test files, or directly merged into the TestBlind regression suite.

---

### 3.2 Workflow 2: Incident-to-Regression Test Generation

```
┌──────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Incident Report, │ ──> │ Traceback Parse  │ ──> │ Root Cause         │
│ Logs, Stacktrace │     │ & Line Mapping   │     │ Hypothesis & Probe │
└──────────────────┘     └──────────────────┘     └────────────────────┘
                                                            │
                                                            ▼
┌──────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Verified Test in │ <── │ Dual-State Run:  │ <── │ AI Reproduction    │
│ Regression Suite │     │ Buggy vs Fixed   │     │ Test Synthesis     │
└──────────────────┘     └──────────────────┘     └────────────────────┘
```

#### Detailed Workflow Steps:
1. **Incident Intake:**
   - User inputs incident report: raw stack trace, application logs, bug description, error code, and relevant source file links or commits.
2. **Traceback Parsing & AST Anchor Mapping:**
   - Automatic extraction of exception types, call stack frames, parameter states, and line numbers.
   - Mapping frames to project repository source code to isolate the faulting AST context.
3. **Hypothesis Formulation & AI Synthesis:**
   - AI analyzes the defect mechanics and generates reproduction test candidates designed to recreate the exact failure conditions and assert expected post-fix behavior.
4. **Dual-State Verification Pipeline (When Both Codebases Available):**
   - **State A (Buggy Code):** The generated reproduction test MUST FAIL with the exact incident signature (matching traceback/error code). This confirms the test accurately reproduces the bug rather than failing on an unrelated syntax error.
   - **State B (Corrected Code):** When fix code is provided or developed, the generated test MUST PASS completely.
5. **Evidence Locking & Suite Cataloging:**
   - The verified test is marked with the Incident ID, timestamp, reproduction execution logs, and cryptographic run hash.
   - Promoted to the permanent Regression Library to prevent future regressions.

---

## 4. Repository Connection & Input Modalities

To accommodate diverse developer workflows, enterprise security boundaries, and ad-hoc testing, TestBlind AI supports four distinct input modalities:

| Modality | Description | Ingestion & Security Flow |
| :--- | :--- | :--- |
| **1. GitHub App & OAuth** | Direct connection to public/private repositories with branch and PR selection. | Scoped GitHub App permissions (read contents, read/write PRs and checks). Cloned into ephemeral tenant volumes with short-lived tokens. |
| **2. Local ZIP Upload** | Upload repository snapshots or project folders directly via the web UI. | Validated on client (size limit: 100MB; disallowed file types: binaries, `.git` histories optional). Unpacked into secure isolated scratch space. |
| **3. Standalone Playground** | Ad-hoc code editor supporting instant paste/entry of code and unit tests. | Multi-language Monaco editor (Python, TypeScript, Go, Java, Rust). Runs in ephemeral sub-second sandboxes without repository requirement. |
| **4. Local CLI (`testblind-cli`)** | Developer terminal CLI for enterprise users who cannot upload proprietary source code to cloud. | CLI runs AST mutation and test execution locally on developer machine or on-prem CI; sends only anonymized AST metadata and failure signatures to SaaS AI. |

---

## 5. Visual Dashboard & UI Architecture

Inspired by the dark-mode **TraceAI Studio** reference specification:
- **Theme:** High-contrast Dark Mode (deep navy/slate `#0F172A`, cards `#1E293B`, subtle `#334155` borders).
- **Header & Navigation:**
  - Sidebar: Project selector, Dashboard, Test Cases, Requirements, Test Scenarios, Execution Runs, Reports, AI Insights, Integrations, Settings.
  - Top Bar: Workspace switcher, Breadcrumb, Date range filter ("Last 30 Days"), User profile & tenant indicator.
- **Top 4 KPI Metrics:**
  1. **Test Cases Overview:** Total test count (e.g. 1,250), breakdown (Automated vs Manual), Automation Rate bar chart.
  2. **Requirement Coverage:** Total requirements (e.g. 320), Covered (295), Untested (25), Donut/radial gauge (92%).
  3. **Test Scenarios Executed:** Total execution runs (450), Passed (380), Failed (70), Green sparkline trend.
  4. **AI-Driven Insights:** Flaky tests predicted (15), Optimization suggestions (8), glowing violet AI indicator.
- **Main Analytics & Visualizations:**
  - **Weekly Execution Status:** Multi-week stacked bar chart tracking Passed (Emerald `#10B981`), Failed (Coral Red `#EF4444`), Skipped (Amber `#F59E0B`), and Blocked (Orange `#F97316`).
  - **Requirement Coverage Analysis:** Donut chart breakdown: Fully Covered (60%), Partially Covered (25%), Not Covered (10%), Obsolete (5%).
- **Recent Test Scenarios Table:**
  - Scenario ID (`SC-1023`), Name (`User Login Flow`), Associated Req (`REQ-55`), Status pill with icon, Execution Time (`1m 20s`), AI Confidence score badge (`98%`).
  - Slide-over scenario drawer revealing execution terminal, mutation diffs, and verification evidence.

---

## 6. Functional Modules & Requirements

### 6.1 Projects & Workspaces
- Multi-project support per organization.
- Repository linking with branch tracking and default test command configs (e.g. `pytest`, `npm test`, `cargo test`).

### 6.2 Test Cases & Test Scenarios
- **Test Case:** Atomic test assertion targeting a specific function or invariant.
- **Test Scenario:** Workflow sequence grouping test cases (e.g. E2E auth flow, checkout mutation run).
- Full tagging, requirement association, author metadata, and mutation history.

### 6.3 Execution Runs & History
- Complete run logs, execution duration, environment variables, exit codes, CPU/memory profiles.
- Live real-time terminal streaming over WebSockets.
- Historical comparison and flakiness delta tracking.

### 6.4 Incident Management
- Incident tickets with severity levels, reproduction status (Unverified, Reproducing, Verified, Healed).
- Traceback parser supporting Python, Node.js/TypeScript, Go, Java, and C# stack traces.
- Automated link between incidents and generated regression tests.

### 6.5 Reports & AI Insights
- Mutation score benchmarking: $\text{Mutation Score} = \frac{\text{Killed Mutants}}{\text{Total Mutants} - \text{Equivalent Mutants}} \times 100\%$.
- Flakiness predictor: flags tests exhibiting non-deterministic execution times or state leakage.
- Dead/Redundant test detection: identifies tests providing duplicate coverage without increasing mutation kill rate.

### 6.6 Evidence & Verification Segregation
**CRITICAL REQUIREMENT:** Strict separation between unexecuted AI suggestions and verified execution evidence.
- **Status Tiers:**
  1. `AI_SUGGESTED`: Generated by LLM, syntax unvalidated, not yet executed. Displayed with dashed purple border and warning badge.
  2. `EXECUTION_PENDING`: Queued in sandbox runner.
  3. `VERIFIED_EXECUTED`: Executed in container sandbox, passed exit code 0, assertions passed, cryptographic SHA-256 execution proof stored. Solid green badge.
  4. `EXECUTION_FAILED`: Executed but failed or caused syntax/runtime crash. Red badge with triage logs.

### 6.7 Multi-Tenant Organizations & RBAC
- Organization hierarchy: Organization → Workspaces → Projects.
- Role-Based Access Control:
  - **Owner:** Billing, organization management, API keys, delete permissions.
  - **Admin:** Team management, integration credentials, project setup.
  - **Engineer:** Create runs, generate tests, upload code, trigger playground.
  - **Viewer:** Read-only access to dashboards, reports, and execution history.

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Security & Untrusted Code Execution
- **Zero API Execution:** No user-supplied code or generated tests may ever execute within the API web server process or container.
- **Containerized Isolation:** Execution runners execute within hardened ephemeral Docker/gVisor containers with:
  - Non-root user execution (`uid=10001`).
  - Read-only root filesystem (`--read-only`).
  - Strict resource quotas: max 1.0 CPU, 1024MB RAM, 100MB disk write tmpfs.
  - Hard timeouts: max 60s per unit test, max 300s per mutation suite run.
  - Zero host filesystem mounts.
  - Network isolation: `--network=none` by default; egress strictly restricted to whitelisted package proxies when dependency fetching is explicitly authorized.
- **Credential Protection:** API keys, GitHub tokens, and tenant secrets encrypted at rest using AES-256-GCM.

### 7.2 Scalability & Concurrency
- Stateless FastAPI web tier horizontally scalable behind reverse proxy / load balancer.
- Background worker pool scalable dynamically based on queue depth in Redis.
- Asynchronous non-blocking I/O for all database queries and external LLM calls.
- Support for 100+ concurrent execution sandboxes per cluster node.

### 7.3 Performance
- API P95 latency < 120ms for all dashboard queries.
- Real-time log streaming latency < 200ms via WebSockets.
- Code Playground response time < 3.0s for single-file analysis and mutation generation.

### 7.4 Responsive Design & Accessibility
- Fully responsive across 375px (mobile), 768px (tablet), 1024px (laptop), and 1440px+ (desktop display).
- WCAG 2.1 AA compliant color contrast (minimum 4.5:1 for normal text, 3:1 for large graphical elements).
- Full keyboard navigation and ARIA landmarks throughout.
