# TestBlind AI — User Manual & Usage Guide

**Document Version:** 1.0.0  
**Target Audience:** QA Engineers, SDETs, Software Developers, Engineering Managers, DevOps / Platform Engineers  
**System Classification:** Enterprise AI-Powered Software Testing SaaS  
**Last Updated:** Phase 10 Baseline  

---

## Table of Contents

1. [Introduction & Core Concepts](#1-introduction--core-concepts)
2. [Access & Authentication](#2-access--authentication)
3. [Workspace & Project Setup](#3-workspace--project-setup)
4. [Codebase Ingestion Modalities](#4-codebase-ingestion-modalities)
5. [Interactive Code Lab (Monaco Playground)](#5-interactive-code-lab-monaco-playground)
6. [AI Test Gap Discovery & Mutation Testing](#6-ai-test-gap-discovery--mutation-testing)
7. [Incident-to-Regression Test Generation](#7-incident-to-regression-test-generation)
8. [Test Catalog, Scenarios & Unified Regression](#8-test-catalog-scenarios--unified-regression)
9. [Reports, Analytics & AI Insights](#9-reports-analytics--ai-insights)
10. [CI/CD Automation & Integrations](#10-cicd-automation--integrations)
11. [Team Management, Sandbox Quotas & Security](#11-team-management-sandbox-quotas--security)
12. [REST API Quick Reference & Examples](#12-rest-api-quick-reference--examples)
13. [Troubleshooting & Frequently Asked Questions](#13-troubleshooting--frequently-asked-questions)

---

## 1. Introduction & Core Concepts

### 1.1 What is TestBlind AI?
**TestBlind AI** (TraceAI Studio) is an AI-native software testing and quality platform designed to eliminate **test blindspots** and automate the creation of **verified regression tests**. 

Standard line or branch coverage metrics can give teams a false sense of security: a test suite can achieve 90% line coverage while failing to assert critical business logic or edge-case invariants. When bugs inevitably reach production, post-mortems often produce quick bug fixes without comprehensive reproduction tests, leaving the codebase vulnerable to silent regressions in future refactors.

TestBlind AI solves both challenges by combining:
- **AST-Driven Semantic Mutation Testing**: Synthesizing targeted code faults (mutants) to prove whether your existing test suite actually catches breaking changes.
- **LLM-Powered Test Synthesis**: Automatically writing targeted unit and integration tests that kill surviving mutants and cover untested edge cases.
- **Dual-State Verification**: Running synthesized tests in isolated sandbox containers against both defective and fixed code to ensure 0% hallucination and 100% executable tests.
- **Incident-to-Regression Automation**: Ingesting production logs and stack traces to automatically synthesize regression tests with exact root cause reproductions.

### 1.2 Core Terminology

| Term | Definition in TestBlind AI |
| :--- | :--- |
| **AST (Abstract Syntax Tree)** | Structural representation of your source code used to identify conditionals, boundary values, and unhandled branches. |
| **Mutant** | A deliberate semantic modification in code (e.g. changing `>=` to `>`, `+` to `-`, or deleting an exception check). |
| **Killed Mutant** | A mutation that causes at least one test in your existing test suite to **fail**. This confirms your tests are actively guarding that logic. |
| **Surviving Mutant** | A mutation that passes unnoticed through your test suite. This represents a confirmed **test blindspot**. |
| **Dual-State Verification** | The validation protocol where a generated test is executed against the mutated/buggy state (must fail) AND the pristine/fixed state (must pass) before being promoted. |
| **Grounded Confidence** | A transparent quality score based on concrete AST mutation evidence rather than uncalibrated LLM guessing. |
| **Execution Sandbox** | Ephemeral, isolated Docker or hardened POSIX container where untrusted test code executes without network access or host credentials. |

---

## 2. Access & Authentication

TestBlind AI features enterprise-grade multi-tenancy with strict tenant data isolation, role-based access control (RBAC), and a seamless Demo Mode sandbox.

### 2.1 User Registration & Workspace Creation
1. Navigate to the web application at `http://localhost:3000` (or your company deployment domain).
2. If unauthenticated, the application displays the **Authentication Gate**.
3. Click **"Need an account? Create one"** to switch to the Registration view.
4. Fill in the required fields:
   - **Full Name**: e.g. `Amit Bora`
   - **Work Email**: e.g. `amitbora007@gmail.com`
   - **Password**: Minimum 8 characters.
   - **Organization Name**: e.g. `ABC` (will generate slug `abc-xxxxxx`).
5. Click **"Create Enterprise Account"**.
6. The system creates your tenant organization, provisions default project structures, assigns you the `OWNER` role, and redirects you directly to your authenticated workspace.

### 2.2 Logging In
1. On the Auth Gate, enter your registered **Work Email** and **Password**.
2. Click **"Sign In to Control Plane"**.
3. A JSON Web Token (JWT) is securely generated and stored in browser session storage (`tb_auth_token`), along with active organization headers (`X-Organization-ID`).

### 2.3 Exploring with Demo Mode
If you wish to explore TestBlind AI without creating an account or connecting a database:
1. On the Auth Gate, click the **"Explore Demo Sandbox"** button at the bottom of the card.
2. Demo mode loads pre-populated realistic fixtures (Acme Corp microservices, interactive mutation test scenarios, and simulated execution runs) with zero risk to production data.
3. To exit Demo Mode, click your user initials in the top-right header and select **"Exit Demo & Log In"**.

### 2.4 User Roles & RBAC Matrix

| Permission / Action | Viewer | Engineer | Admin | Owner |
| :--- | :---: | :---: | :---: | :---: |
| View Dashboards, Test Catalog, Reports & Runs | ✅ | ✅ | ✅ | ✅ |
| Run Code Lab Monaco Playground | ✅ | ✅ | ✅ | ✅ |
| Execute Mutation Scans & Test Generation | ❌ | ✅ | ✅ | ✅ |
| Approve / Reject Synthesized Regression Tests | ❌ | ✅ | ✅ | ✅ |
| Link Git Repositories & Upload ZIP Archives | ❌ | ✅ | ✅ | ✅ |
| Manage Integrations (GitHub, Slack, Jira) | ❌ | ❌ | ✅ | ✅ |
| Invite Members & Manage Roles | ❌ | ❌ | ✅ | ✅ |
| Billing & Organization Ownership Transfer | ❌ | ❌ | ❌ | ✅ |

---

## 3. Workspace & Project Setup

Projects represent codebases or microservices within your organization. Each project tracks its repository, default branch, test harness, and historical test metrics.

### 3.1 Viewing Active Projects
- In the left sidebar, click **"Projects"** (`/#projects`).
- The Projects catalog displays all tracked repositories, languages, test frameworks, total ingested tests, and average mutation scores.

### 3.2 Creating a New Project
1. In the **Projects** view, click the **"+ New Project"** button in the top right.
2. Complete the project configuration modal:
   - **Project Name**: e.g. `Payment-Gateway` or `Core-Auth-Service`.
   - **Repository URL**: Git clone URL (e.g. `https://github.com/my-org/payment-service`).
   - **Primary Language**: Select `Python`, `TypeScript`, `JavaScript`, or `Go`.
   - **Test Framework**: Choose `pytest`, `vitest`, `jest`, or `go test`.
   - **Default Branch**: Default is `main` (or `develop`, `release/v2.1`).
3. Click **"Create Project"**.

---

## 4. Codebase Ingestion Modalities

TestBlind AI supports three ingestion modalities directly within the **"Projects"** page (`/#projects`) via the **"+ Connect Codebase / New Project"** workflow.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPOSITORIES & CODE INGESTION                         │
│  ┌───────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐  │
│  │ 1. GitHub Repository  │ │ 2. Local ZIP Upload │ │ 3. On-Prem CLI      │  │
│  │ - GitHub App / OAuth  │ │ - 100MB Max Archive │ │ - `testblind-cli`   │  │
│  │ - Personal Access Tok │ │ - Zip-Slip Defense  │ │ - Local air-gapped  │  │
│  │ - Automated PR Checks │ │ - Auto-detect Tests │ │ - Zero code upload  │  │
│  └───────────────────────┘ └─────────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Modality 1: GitHub Integration (Recommended for CI/CD)
Connect your GitHub organization to automatically sync repositories, trigger scans on Pull Requests, and post status checks.
1. Select the **"GitHub Repository"** tab.
2. In **Select Repository**, choose from your organization's linked project repositories or enter a custom repository name / URL.
3. Specify the **Target Branch** (e.g. `main`).
4. Set the **Test Execution Command** (e.g. `pytest --tb=short tests/` or `npm test`).
5. (Optional) Define a **Subdirectory Scope** (e.g. `services/api/` or `backend/`).
6. Click **"Verify & Scan AST"**. TestBlind AI connects to the repository, analyzes the AST structure, and prepares mutation candidates.

> **Connecting GitHub via Personal Access Token (PAT):**  
> If your organization does not use the central GitHub App, navigate to **Integrations** (`/#integrations`), click **GitHub**, and input a Personal Access Token with `repo:read` scope.

### 4.2 Modality 2: Local ZIP Archive Upload (Fastest for Local Codebases)
For rapid testing of local projects without linking GitHub:
1. Select the **"Local ZIP Upload"** tab.
2. Drag and drop a standard `.zip` archive of your codebase (up to 100MB).
3. The upload engine automatically enforces security defenses:
   - **Magic Byte Validation**: Confirms valid PKZIP format.
   - **Zip-Slip Path Traversal Defense**: Blocks unauthorized writes (`../`).
   - **Zip-Bomb Protection**: Rejects excessive compression ratios.
4. The system automatically inspects configuration files (`requirements.txt`, `package.json`, `pytest.ini`) to auto-detect:
   - Primary programming language
   - Installed test runner
   - Recommended execution command
5. Click **"Analyze Extracted Codebase"** to open the project directly in Test Gap Discovery.

### 4.3 Modality 3: On-Premise Local CLI (`testblind-cli`)
For enterprise organizations with strict air-gapped environments or policies prohibiting source code uploads:
1. Select the **"On-Prem Local CLI"** tab.
2. Click **"Generate CLI Token"** to receive an authenticated token.
3. Install the CLI binary or run via npm/python:
   ```bash
   pip install testblind-cli
   # or
   npm install -g @testblind/cli
   ```
4. Execute the scan locally inside your infrastructure:
   ```bash
   testblind scan \
     --token "<YOUR_CLI_TOKEN>" \
     --project-id "Payment-Gateway" \
     --runner "pytest" \
     --path ./src
   ```
5. Only the anonymized AST mutation fingerprints and test results are reported back to the control plane; your source code never leaves your workstation.

---

## 5. Interactive Code Lab (Monaco Playground)

The **Code Lab** (`/#code-lab`) provides an instant, interactive Monaco editor where you can test code snippets, inject mutations, and observe execution runs without setting up a repository.

### 5.1 Using the Monaco Editor
1. In the left navigation, click **"Code Lab"**.
2. Select your language runtime from the dropdown (`Python 3.12` or `TypeScript / Node.js 20`).
3. Choose a template or paste your own code:
   - `JWT Authentication & Token Validation`
   - `Idempotent Payment Processor`
   - `Rate Limiter & Sliding Window`
4. Use the dual-pane editor:
   - **Left Pane:** Source Code under test.
   - **Right Pane:** Unit test suite.

### 5.2 Injecting AST Mutations
1. Click **"Generate Mutations"** in the action bar.
2. The AST engine analyzes your source code and generates semantic mutations:
   - **Relational:** `>` replaced with `>=`
   - **Arithmetic:** `rate * duration` replaced with `rate / duration`
   - **Logical:** `is_admin and is_active` replaced with `is_admin or is_active`
3. Click on any mutation pill in the list to highlight the diff in the editor.

### 5.3 Running the Sandbox Verification
1. Click **"Run Test in Sandbox"**.
2. The code is packaged and dispatched to an isolated container.
3. The bottom terminal drawer streams execution logs in real-time.
4. Results show:
   - **Execution Time** (e.g. `142ms`)
   - **Exit Code** (`0` for pass, `1` for fail)
   - **Mutant Status**: `KILLED` (test caught the mutation) or `SURVIVED` (blindspot detected).

---

## 6. AI Test Gap Discovery & Mutation Testing

**Test Gap Discovery** (`/#gap-discovery`) is the core engine for uncovering test blindspots in production repositories.

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Source Code &   │ ──> │ AST Mutation     │ ──> │ Containerized       │
│  Existing Tests  │     │ Matrix Engine    │     │ Sandbox Execution   │
└──────────────────┘     └──────────────────┘     └─────────────────────┘
                                                             │
                                                             ▼
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Verified Test in │ <── │ Dual-State Gate: │ <── │ AI Test Synthesis   │
│ Regression Suite │     │ Fail Bug/Pass Fix│     │ (Kills Survivors)   │
└──────────────────┘     └──────────────────┘     └─────────────────────┘
```

### 6.1 Step-by-Step Workflow
1. Navigate to **"Test Gap Discovery"** in the sidebar.
2. Select the target **Project** and **Branch**.
3. Click **"Start Mutation Analysis"**.
4. The engine executes the mutation suite across your files and categorizes results:
   - **Killed Mutants (Green):** Functions where existing tests correctly failed when behavior was altered.
   - **Surviving Mutants (Red/Amber):** Functions where tests passed despite bugs introduced in code.
   - **Timed Out (Gray):** Infinite loop candidates killed by runner timeouts.

### 6.2 Generating AI Tests to Kill Survivors
1. In the Surviving Mutants table, inspect the specific code change and line number.
2. Click **"Synthesize Test with AI"**.
3. TestBlind AI sends the AST context and mutation signature to the LLM.
4. The LLM generates a targeted test assertion specifically designed to exercise the boundary condition.
5. **Dual-State Verification Gate**:
   - The test is executed against the mutated code -> must fail.
   - The test is executed against the pristine code -> must pass.
6. Once verified, click **"Promote to Test Catalog"** or **"Create Pull Request"**.

---

## 7. Incident-to-Regression Test Generation

The **Incident Analysis** module (`/#incidents`) turns production downtime into permanent regression protection.

### 7.1 Ingesting an Incident
1. Navigate to **"Incident Analysis"** in the sidebar.
2. Click **"+ New Incident Ingestion"**.
3. Enter incident details:
   - **Incident Title**: e.g. `Null pointer in payment settlement ledger on zero-amount refunds`.
   - **Severity**: `Critical (P0)`, `High (P1)`, `Medium (P2)`, `Low (P3)`.
   - **Associated Project**: Select the affected project.
   - **Production Logs & Traceback**: Paste the raw stack trace or log excerpt:
     ```python
     Traceback (most recent call last):
       File "services/refund.py", line 42, in process_refund
         fee = refund.amount * fee_multiplier
     TypeError: unsupported operand type(s) for *: 'NoneType' and 'float'
     ```

### 7.2 AST Stack Frame Anchor Mapping
1. Click **"Analyze & Map to AST"**.
2. TestBlind AI extracts the filename (`services/refund.py`), line number (`42`), and function AST node (`process_refund`).
3. The engine anchors the root cause to the exact source code block.

### 7.3 Synthesizing & Verifying Reproduction Tests
1. Click **"Generate Reproduction Test"**.
2. The AI writes an executable test that feeds the exact defect parameters into the function.
3. TestBlind AI validates the test via **Dual-State Verification**:
   - **Buggy State (Pre-Fix):** The reproduction test **fails** with the exact `TypeError` signature.
   - **Fixed State (Post-Fix):** When the patch (`if refund.amount is None: ...`) is applied, the test **passes**.
4. The verified test is saved in the **Test Cases** catalog with tag `incident-repro`.

---

## 8. Test Catalog, Scenarios & Unified Regression

### 8.1 Test Cases Catalog (`/#test-cases`)
The unified repository for all verified tests across all projects.
- **Filtering & Search**: Search by test name, tags (`incident-repro`, `ast-mutation`, `edge-case`), priority, or status.
- **Assertion Metrics**: Shows verified assertion count per test.
- **Normalized Code Hash Deduplication**: Every test's AST is normalized (stripping comments and formatting) and SHA-256 hashed to prevent duplicate test generation.

### 8.2 Review & Approval Workflows
To maintain quality standards, tests can require peer approval before CI promotion:
1. Click on a test case in **Review Required** status.
2. Review the diff and execution logs.
3. Click **"Approve Test"** or **"Reject"**.
4. The reviewer's identity and timestamp are recorded in the audit trail.

### 8.3 Test Scenarios Canvas (`/#test-scenarios`)
Create and manage multi-step user journey test scenarios (e.g. `User Registration -> OAuth Authorization -> Payment Checkout -> Refund`).
- View step dependencies and execution ordering.
- Trigger sequential scenario runs with one click.

### 8.4 Execution Runs & Live Terminal Logs (`/#execution-runs`)
Monitor past and current test suite runs:
- Status indicators: `PASSED`, `FAILED`, `BLOCKED`, `RUNNING`.
- Real-time terminal output drawer streaming stdout/stderr.
- Downloadable execution trace artifacts.

---

## 9. Reports, Analytics & AI Insights

### 9.1 TraceAI Studio Dashboard (`/#dashboard`)
The command center for engineering leadership:
- **Test Cases Overview**: Total verified assertions and automation rate.
- **Requirement Coverage Donut**: Breakdown of fully covered, partially covered, and untested requirements.
- **Test Scenarios Executed**: Execution velocity and trendlines.
- **AI-Driven Insights KPI**: Actionable quality improvements.
- **30-Day Execution Status**: Multi-week stacked bar chart tracking test passes, failures, and flakes.

### 9.2 Quality & Mutation Reports (`/#reports`)
Detailed reports on codebase resilience:
- **Mutation Score %**: Percentage of injected mutations killed by test suites.
- **Blindspot Breakdown**: Critical modules with low assertion density.
- **Exporting Reports**: Export quality audit data as PDF or CSV for executive reviews.

### 9.3 AI Insights (`/#ai-insights`)
Proactive suggestions generated from historical test performance:
- **Flaky Test Predictions**: Identifies non-deterministic assertions susceptible to timing errors.
- **Coverage Blindspots**: Flags functions with high cyclomatic complexity and zero mutation tests.

---

## 10. CI/CD Automation & Integrations

Integrate TestBlind AI directly into your continuous integration pipelines to prevent test blindspots from entering production.

### 10.1 GitHub Actions Workflow Template
Add `.github/workflows/testblind.yml` to your repository:

```yaml
name: TestBlind AI Regression Gate

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  testblind-verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Trigger TestBlind Verification
        uses: testblind-ai/github-action@v1
        with:
          api-url: 'https://api.testblind.ai'
          auth-token: ${{ secrets.TESTBLIND_API_KEY }}
          project-id: 'Payment-Gateway'
          min-mutation-score: 80
          fail-on-survived-mutants: true
```

### 10.2 Slack & Jira Alerts
Navigate to **Integrations** (`/#integrations`):
- **Slack Alerts**: Connect a Slack incoming webhook to receive notifications when surviving mutants or broken regression tests are detected.
- **Jira Software**: Automatically file Jira bug tickets whenever an incident reproduction test is generated.

---

## 11. Team Management, Sandbox Quotas & Security

### 11.1 Managing Team Members
1. Navigate to **Team & Settings** (`/#team-settings`).
2. View your organization's active members and roles.
3. Click **"+ Invite Team Member"**.
4. Enter their email address and select their assigned role (`Viewer`, `Engineer`, or `Admin`).
5. An invitation link is generated.

### 11.2 Runner Sandbox Security Policies
TestBlind AI enforces strict isolation on every test execution:
- **Non-Root Execution**: Container runner processes execute under `uid=10001` (`tb_runner`).
- **Network Isolation**: All test executions run with `--network=none` to prevent data exfiltration.
- **Resource Limits**:
  - Max CPU Execution Time: 30 seconds default (60s wall clock).
  - Max Memory Allocation: 512 MB per container.
  - Max Disk Output: 1 MB memory-safe log buffer.
- **Credential Scrubbing**: Environment variables (AWS, GitHub tokens, database passwords) are completely stripped from sandbox runner environments.

### 11.3 Generating API Keys
In **Team & Settings** > **API Keys & Audit**:
1. Click **"Create API Key"**.
2. Assign a key name (e.g. `GitHub-Actions-CI`).
3. Copy the token (`tb_live_...`) and store it securely in your CI secrets manager.

---

## 12. REST API Quick Reference & Examples

All API requests must include the `Authorization` header and organization context:
```http
Authorization: Bearer <JWT_OR_API_KEY>
X-Organization-ID: <ORGANIZATION_UUID>
Content-Type: application/json
```

### 12.1 Authentication & Profile
```bash
# User Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "amitbora007@gmail.com", "password": "your_password"}'

# Get Current User & Organization Context
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### 12.2 Projects & Repositories
```bash
# List Organization Projects
curl http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Organization-ID: <ORG_ID>"

# Create a New Project
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Organization-ID: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment-Service",
    "framework": "pytest",
    "default_branch": "main"
  }'

# List Available Repositories
curl http://localhost:8000/api/v1/integrations/github/repos \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Organization-ID: <ORG_ID>"
```

### 12.3 Triggering Runs & Ingesting Incidents
```bash
# Trigger an AST Mutation Scan
curl -X POST http://localhost:8000/api/v1/scan-jobs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Organization-ID: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<PROJECT_UUID>",
    "scan_type": "mutation",
    "target_branch": "main"
  }'

# Ingest an Incident
curl -X POST http://localhost:8000/api/v1/incidents \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Organization-ID: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<PROJECT_UUID>",
    "title": "Refund processing NullPointer defect",
    "severity": "high",
    "raw_logs": "Traceback (most recent call last): ..."
  }'
```

---

## 13. Troubleshooting & Frequently Asked Questions

### Q1: Why does the repository selector say "GitHub Integration Ready" instead of showing external repos?
**Answer:** TestBlind AI verifies whether server GitHub credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) and organization credentials are active. If an external GitHub App or Personal Access Token (PAT) is not connected, the dropdown displays your organization's registered projects (`abc-xxxx/project-name`). To view external repos, input a Personal Access Token in **Integrations** or use the **Enter custom repository name / URL** button.

### Q2: Why did my synthesized test fail verification?
**Answer:** TestBlind AI enforces strict **Dual-State Verification**. If an AI-generated test passes on mutated code, or fails on clean pristine code, the engine rejects it as a hallucination to protect your test suite from false alarms.

### Q3: Can I test private code without sending it to the cloud?
**Answer:** Yes! Use **Modality 3 (On-Premise Local CLI)**. The `testblind-cli` runs the mutation engine and tests entirely on your local machine or internal CI server, sending only anonymized mutation scores back to the control plane.

### Q4: How are tests deduplicated?
**Answer:** Every test is converted to an Abstract Syntax Tree (AST), stripped of non-functional comments and whitespace, and hashed via SHA-256. If a newly generated test matches an existing hash, it is marked as a duplicate and omitted.

---

## Need Further Assistance?
- **Operations Runbook:** [`docs/runbook.md`](./runbook.md)
- **Architecture Specifications:** [`docs/architecture.md`](./architecture.md)
- **Product Requirements:** [`docs/product-spec.md`](./product-spec.md)
- **Local Deployment Guide:** [`docs/deployment.md`](./deployment.md)
