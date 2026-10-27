# TestBlind AI — Production & Operations Runbook

**Document Version:** 1.0.0  
**Target Audience:** DevOps Engineers, Site Reliability Engineers (SREs), QA Architects, Platform Operators  
**System Classification:** Enterprise AI Software Testing SaaS  
**Last Verified:** Phase 10 Release Readiness Baseline  

---

## 1. System Overview & Architecture Topology

TestBlind AI is an enterprise SaaS platform engineered to eliminate test blindspots by pairing **AST-driven mutation testing**, **LLM test synthesis**, and **containerized dual-state verification**.

### 1.1 Architectural Decoupling

Under no circumstances does untrusted user code or generated test suites execute within the API Web Process or Control Plane.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / PRESENTATION                             │
│       React 19 + TypeScript + Vite SPA (Port 3000 / Preview 4173)           │
│       - TraceAI Studio Dark Theme                                           │
│       - Auth Gate (Live Backend Login & Demo Mode Tour)                     │
│       - Monaco Code Lab Playground                                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS / REST
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE TIER                                │
│       FastAPI ASGI Web Process (Port 8000)                                  │
│       - Authentication & Multi-Tenant RBAC (/api/v1/auth)                   │
│       - Project & Repository Management (/api/v1/projects)                  │
│       - AST Mutation Engine & Gap Discovery (/api/v1/scan-jobs)             │
│       - Incident Intake & Dual-State Verifier (/api/v1/incidents)           │
│       - Test Library & Execution Runs (/api/v1/test-cases, /runs)           │
│       - CI/CD Runner Gateway (/api/v1/ci)                                   │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
        ┌───────────────▼──────────────┐ ┌──────────────▼──────────────┐
        │       STATE & BROKER         │ │    ASYNC JOB QUEUE FLEET    │
        │ - PostgreSQL 16 + pgvector   │ │ - Bounded Worker Fleet (x4) │
        │   (Port 5432)                │ │ - Fair-Share Quotas (x2/org)│
        │ - Redis 7.2 Broker & Cache   │ │ - Exponential Retry Policy  │
        │   (Port 6379)                │ │ - Idempotent Job Registry   │
        └──────────────────────────────┘ └──────────────┬──────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION PLANE TIER                              │
│       Isolated Disposable Sandboxes (Docker / Hardened POSIX Fallback)      │
│       - UID 10001 (Non-root runner)                                         │
│       - Read-only root filesystem, --network=none                           │
│       - POSIX Limits: 30s/60s CPU, 512MB RAM, 20MB file, 64 processes       │
│       - Memory-safe stdout truncation (1MB buffer)                          │
│       - Zero-credential environment scrubbing (AWS, GitHub, JWT, DB URIs)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Setup & Quickstart

### 2.1 Prerequisites
- **Python:** 3.12+ (3.13 tested)
- **Node.js:** 20.x or 22.x LTS, npm 10.x
- **PostgreSQL:** 16+ (or Docker image `postgres:16-alpine`)
- **Redis:** 7.x (or Docker image `redis:7-alpine`)
- **Docker Engine:** 24.0+ (optional for Docker-based runner sandboxes; local POSIX runner fallback is built-in)

### 2.2 Native Local Development Setup

#### Step 1: Clone & Configure Environments
```bash
git clone https://github.com/organization/testblind-ai.git
cd "TestBlind AI"

# Configure backend environment
cp backend/.env.example backend/.env

# Configure frontend environment
cp frontend/.env.example frontend/.env
```

#### Step 2: Backend Setup & Migrations
```bash
# Create and activate Python virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# Run database migrations
alembic -c backend/alembic.ini upgrade head

# Run backend automated test suite (83 tests)
pytest backend/tests -v
```

#### Step 3: Frontend Setup & Build
```bash
# Install dependencies
npm --prefix frontend install

# Production build
npm --prefix frontend run build
```

### 2.3 Starting Application Services

#### Terminal 1: Backend API (FastAPI)
```bash
source backend/.venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
> **Note:** The backend automatically bootstraps `backend/` to `sys.path`. You can also run `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload`.

#### Terminal 2: Frontend Client (Vite)
```bash
# Development mode with hot-reloading:
npm --prefix frontend run dev -- --port 3000

# OR production preview:
npm --prefix frontend run preview -- --port 4173
```

---

## 3. Authentication & Tenant Onboarding

### 3.1 Live Authenticated Mode vs Demo Tour
When opening the web application at `http://localhost:3000`:
1. **Unauthenticated Default:** The application renders the **Auth Gate** (`AuthPage.tsx`).
2. **Sign In (`POST /api/v1/auth/login`):**
   - Enter registered email and password.
   - On success, the API issues a signed JWT (`HS256`, 24h validity).
   - The frontend stores the token in `localStorage.tb_auth_token` and automatically fetches `/api/v1/auth/me` to load the user profile and active organization ID.
3. **Create Account (`POST /api/v1/auth/register`):**
   - Provide Full Name, Work Email, Password, and Organization Name.
   - The backend creates the user, generates a dedicated tenant organization, and assigns the user the `OWNER` role.
4. **Explore in Demo Mode:**
   - Click **"Explore in Demo Mode (No backend required)"**.
   - The frontend sets `localStorage.tb_demo_mode = 'true'` and unlocks all 13 interactive modules with simulated test pipelines, mutation analysis, and sample datasets.
5. **Signing Out / Switching Mode:**
   - Click the user avatar in the top-right header and select **"Sign Out"** or **"Exit Demo / Sign In"**.

### 3.2 Role-Based Access Control (RBAC) Matrix

| Permission | OWNER | ADMIN | ENGINEER | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| View Dashboards, Test Scenarios & Reports | Yes | Yes | Yes | Yes |
| Run Standalone Code Lab Sandbox | Yes | Yes | Yes | Yes |
| Download Test Suites & CSV/JSON Exports | Yes | Yes | Yes | Yes |
| Upload Repositories (ZIP / Git Link) | Yes | Yes | Yes | Read-Only |
| Trigger Mutation Scans & AI Test Synthesis | Yes | Yes | Yes | Read-Only |
| Submit Production Incidents & Verify Reproduction | Yes | Yes | Yes | Read-Only |
| Approve / Reject Test Cases in Library | Yes | Yes | Yes | Read-Only |
| Manage Integrations & Generate CI Runner Tokens | Yes | Yes | Read-Only | Read-Only |
| Invite / Remove Organization Members & Assign Roles | Yes | Yes | No | No |
| Delete Projects & Permanent Tenant Data | Yes | No | No | No |

---

## 4. Standard Operating Procedures (SOPs)

### SOP-01: Repository Intake & Safe Unpacking
1. Navigate to **Repositories & Upload** (`/#repositories`).
2. Select target project.
3. Drag-and-drop a project snapshot ZIP archive.
4. **Security Enforcement:**
   - The archive service checks magic bytes (`PK\x03\x04`), rejecting renamed executables.
   - Zip Slip protection validates `os.path.commonpath([dest, target]) == dest`, preventing path traversal (`../../`).
   - Caps uncompressed size to 500MB and file count to 10,000 files.
5. The structure detector auto-detects language (`python`, `typescript`) and test runner (`pytest`, `jest`).

### SOP-02: AI Test Gap Discovery & Mutation Testing
1. Navigate to **Test Gap Discovery** (`/#gap-discovery`).
2. Select project and click **"Run Mutation Gap Scan"**.
3. **Execution Pipeline:**
   - **Step 1:** Runs baseline test suite in isolated sandbox (`--network=none`, UID 10001).
   - **Step 2:** AST engine generates mutants across 4 operators:
     - `ROR`: Relational Operator Replacement (`>` <-> `>=`, `==` <-> `!=`).
     - `AOR`: Arithmetic Operator Replacement (`+` <-> `-`, `*` <-> `/`).
     - `LCR`: Logical Connector Replacement (`and` <-> `or`).
     - `BSR`: Boundary Shift Replacement (`x > 10` -> `x > 11`).
   - **Step 3:** Re-executes test suite against each mutant. Surviving mutations indicate gaps.
   - **Step 4:** Click **"Synthesize Killer Test"** on any surviving mutant.
   - **Step 5 (Dual-State Verification Gate):**
     - Gate 1: Test MUST PASS on pristine code.
     - Gate 2: Test MUST FAIL on mutated code.
   - **Step 6:** Click **"Promote to Library"** to catalog the certified test with its SHA-256 evidence hash.

### SOP-03: Incident-to-Regression Test Generation
1. Navigate to **Incident-to-Regression** (`/#incidents`).
2. Click **"New Incident"** and paste the production stack trace and expected vs actual behavior.
3. **Sanitization Guardrail:** The regex scrubber strips all credentials, AWS keys (`AKIA...`), GitHub PATs (`ghp_...`), JWTs, database passwords, and customer emails prior to persistence.
4. **Context Adequacy Check:** If source code is missing, the incident is set to `needs_more_info` with explicit missing details; the platform never fabricates hallucinated reproductions.
5. Click **"Execute Dual-State Verification"**:
   - State A: Confirms candidate test reproduces the failure on buggy code (`exit_code != 0`).
   - State B: Confirms candidate test passes cleanly on corrected code (`exit_code == 0`).
6. Click **"Promote to Catalog"** to lock the reproduction test into the regression suite.

### SOP-04: CI/CD Pipeline Automation
1. Generate an API runner token in **Integrations & CI/CD** (`/#integrations`).
2. Add the token to GitHub Secrets as `TESTBLIND_TOKEN`.
3. Add the workflow to `.github/workflows/testblind-regression.yml`:
```yaml
name: TestBlind Regression Protection
on: [pull_request, push]
jobs:
  testblind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trigger TestBlind Scan
        run: |
          curl -s -X POST "${{ secrets.TESTBLIND_API_URL }}/api/v1/ci/runs" \
            -H "X-TestBlind-Token: ${{ secrets.TESTBLIND_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repository_url": "${{ github.repository }}",
              "branch": "${{ github.ref_name }}",
              "commit_sha": "${{ github.sha }}",
              "trigger_source": "github_actions"
            }'
```

---

## 5. Health Checks, Probes & Observability

### 5.1 Endpoints Specification

| Probe | Endpoint | Method | Expected Output | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| **Liveness** | `/healthz` or `/api/v1/health/live` | GET | `200 OK` `{"status":"ok"}` | Validates ASGI process is alive. Used by Kubernetes `livenessProbe`. |
| **Readiness** | `/readyz` or `/api/v1/health/ready` | GET | `200 OK` or `503 Service Unavailable` | Validates PostgreSQL, Redis, and runner socket connectivity. Used by Kubernetes `readinessProbe`. |
| **Worker Health** | `/api/v1/workers/health` | GET | `200 OK` `{"workers_active": N}` | Telemetry on worker pool capacity and active executions. |
| **Queue Stats** | `/api/v1/queue/stats` | GET | `200 OK` `{"queued": N, "running": N}` | Background job queue depth and tenant quotas. |

### 5.2 Kubernetes Pod Health Probe Configuration
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## 6. Security & Sandbox Isolation Architecture

1. **Non-Root Execution:** Runner processes run under `UID 10001` with read-only root filesystems.
2. **Network Disablement:** Untrusted code runs with `--network=none` (Docker) or socket isolation (POSIX).
3. **Resource Quotas (POSIX `setrlimit`):**
   - CPU: 30s soft limit / 60s hard limit (`SIGXCPU` / `SIGKILL`).
   - Memory (Address Space): 512MB RAM cap.
   - Max Processes: 64 child processes max (blocks fork bombs).
   - Max File Size: 20MB.
4. **Buffer Exhaustion Defense:** Stdout/stderr capped at 1MB (`EXECUTION_MAX_OUTPUT_BYTES`); excess output is truncated with `[OUTPUT TRUNCATED]`.
5. **Disposable Workspaces:** Ephemeral workspaces in `/tmp/testblind_sandboxes/` are automatically deleted upon job completion.
6. **GitGuardian & Secret Leak Prevention:**
   - The repository includes [.gitguardian.yaml](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/.gitguardian.yaml).
   - Test suites construct mock secrets dynamically to prevent false-positive static scanner alerts in Git diffs.

---

## 7. Troubleshooting Guide & Incident Resolution

### Issue 1: `ModuleNotFoundError: No module named 'app'` when running Uvicorn
- **Symptom:** Starting `uvicorn backend.app.main:app` fails with `ModuleNotFoundError: No module named 'app'`.
- **Root Cause:** When running from the repository root, Python's `sys.path` points to the workspace root rather than `backend/`.
- **Resolution:**
  - `backend/app/main.py` has been updated with auto-bootstrap logic to insert `backend/` into `sys.path` automatically.
  - Alternatively, pass `--app-dir backend`:
    ```bash
    uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
    ```

### Issue 2: Health Readiness Probe returns `503 Service Unavailable`
- **Symptom:** `GET /readyz` fails with status 503.
- **Diagnostic:** Check the JSON response for `"database": "down"` or `"redis": "down"`.
- **Resolution:**
  1. If Database down:
     ```bash
     # Verify PostgreSQL is running
     pg_isready -h localhost -p 5432
     # Verify connection string in backend/.env matches credentials
     ```
  2. If Redis down:
     ```bash
     redis-cli -h localhost -p 6379 ping
     ```
  3. Once connectivity is restored, `/readyz` automatically recovers to `200 OK` without restarting the FastAPI service.

### Issue 3: Docker runner returns `permission denied` on `/var/run/docker.sock`
- **Symptom:** Running tests in sandbox reports Docker daemon socket permission errors.
- **Behavior:** TestBlind AI features automated **seamless fallback**: if Docker daemon access is restricted, the platform automatically engages `HardenedSubprocessDriver`, enforcing POSIX `setrlimit` boundaries on host processes with zero disruption.
- **Resolution (if Docker is desired):**
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker
  ```

### Issue 4: Frontend starts directly in Demo Mode or bypasses Login
- **Symptom:** User wants to log in with real credentials, but the app skips to demo dashboard.
- **Resolution:**
  - Click the user avatar in the top-right header and select **"Sign Out"** (or **"Exit Demo / Sign In"**).
  - This purges `localStorage.tb_demo_mode` and `localStorage.tb_auth_token` and displays the Login / Register screen.

---

## 8. Backup, Migrations & Maintenance Procedures

### 8.1 Database Migrations (Alembic)
```bash
# Check current migration revision
alembic -c backend/alembic.ini current

# Apply all pending migrations
alembic -c backend/alembic.ini upgrade head

# Roll back one revision (if emergency rollback is required)
alembic -c backend/alembic.ini downgrade -1
```

### 8.2 Database Backup (PostgreSQL)
```bash
# Create timestamped database snapshot
pg_dump -h localhost -U testblind_admin -d testblind_db -Fc > "backup_testblind_$(date +%Y%m%d_%H%M%S).dump"

# Restore from snapshot
pg_restore -h localhost -U testblind_admin -d testblind_db -c "backup_testblind_20261027_120000.dump"
```

### 8.3 Operational Health Check Routine
```bash
# 1. Probe application health
curl -s http://127.0.0.1:8000/healthz

# 2. Probe dependency readiness
curl -s http://127.0.0.1:8000/readyz

# 3. Check worker fleet status
curl -s http://127.0.0.1:8000/api/v1/workers/health

# 4. Check queue depth
curl -s http://127.0.0.1:8000/api/v1/queue/stats
```
