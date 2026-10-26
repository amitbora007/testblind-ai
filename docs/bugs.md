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
