# TestBlind AI — Configuration, Deployment & Operations Guide

**Document Version:** 1.0.0
**Status:** Approved Operational Baseline
**Target Environments:** Local Development, CI/CD Staging, Production Cloud

---

## 1. System Requirements & Prerequisites

### 1.1 Local Development Prerequisites
- **Operating System:** Linux (Ubuntu 22.04+ / Debian 12 / Fedora), macOS (Sonoma+), or Windows with WSL2.
- **Docker Engine:** Version 24.0+ (Docker 29+ recommended) with Docker Compose v2.20+.
- **Node.js Runtime:** Node.js v20.x or v22.x LTS, npm v10.x.
- **Python Environment:** Python 3.12+ (3.12 or 3.14).
- **Git:** Version 2.40+.
- **Rust Tooling (Optional / User Rule):** `rtk` (Rust Token Killer) v0.40+ installed in `~/.local/bin/`.

### 1.2 Production Infrastructure Requirements
- **Compute Cluster:** Kubernetes 1.28+ (EKS, GKE, or AKS) or AWS ECS with Fargate / EC2 worker pools.
- **Database:** Managed PostgreSQL 16 with `pgvector` extension (AWS Aurora, Google Cloud SQL, or Azure Flexible Server).
- **Cache & Broker:** Managed Redis 7.2+ (AWS ElastiCache, GCP Memorystore, or Upstash).
- **Object Storage:** AWS S3, Google Cloud Storage, or Azure Blob Storage (MinIO for local dev).
- **Container Isolation Runtime:** gVisor (`runsc`) or Kata Containers runtime handler enabled on worker nodes.

---

## 2. Architecture & Service Topology

```
┌─────────────────────────────────────────────────────────────┐
│ Docker Compose Topology (Local Dev & Testing)               │
├───────────────────┬─────────────────────────────────────────┤
│ Service           │ Internal Port / Binding                 │
├───────────────────┼─────────────────────────────────────────┤
│ `testblind-web`   │ 3000 -> 3000 (React Vite Dev Server)    │
│ `testblind-api`   │ 8000 -> 8000 (FastAPI ASGI Web Tier)    │
│ `testblind-worker`│ Background Celery / Arq Worker Fleet    │
│ `postgres`        │ 5432 -> 5432 (PostgreSQL 16 + pgvector) │
│ `redis`           │ 6379 -> 6379 (Redis 7.2 Alpine)         │
│ `minio`           │ 9000 (API), 9001 (Console UI)           │
└───────────────────┴─────────────────────────────────────────┘
```

---

## 3. Environment Variables & Secret Configuration

Never commit production secrets, private keys, or API tokens to source control. Create a local `.env` file from the canonical `.env.example` specification below:

```bash
# ==============================================================================
# TestBlind AI — Environment Configuration Template (.env.example)
# ==============================================================================

# Application Environment
ENVIRONMENT=development                # development | staging | production
DEBUG=true
APP_SECRET_KEY=change-this-in-production-use-a-strong-32-byte-hex-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440       # 24 Hours

# Service URLs
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000

# Database Configuration (PostgreSQL 16 + pgvector)
POSTGRES_USER=testblind_admin
POSTGRES_PASSWORD=testblind_dev_password_change_me
POSTGRES_DB=testblind_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://testblind_admin:testblind_dev_password_change_me@postgres:5432/testblind_db

# Redis & Message Broker Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://redis:6379/0

# Object Storage (MinIO Local / AWS S3 Production)
S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minio_admin_user
S3_SECRET_KEY=minio_admin_password_change_me
S3_BUCKET_NAME=testblind-artifacts
S3_REGION=us-east-1

# LLM Synthesis Providers (Configure at least one)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
DEFAULT_LLM_PROVIDER=anthropic         # anthropic | openai | gemini
DEFAULT_LLM_MODEL=claude-3-5-sonnet-20241022

# Untrusted Execution Sandbox Configuration
DOCKER_HOST_SOCKET=/var/run/docker.sock
SANDBOX_DEFAULT_TIMEOUT_SECONDS=60
SANDBOX_MAX_MEMORY_MB=1024
SANDBOX_MAX_CPU_CORES=1.0
SANDBOX_IMAGE_PYTHON=testblind-runner-python:3.12
SANDBOX_IMAGE_NODE=testblind-runner-node:20

# GitHub App Integration
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_WEBHOOK_SECRET=
```

---

## 4. Local Development Quickstart

### 4.1 Automated Docker Compose Launch
To launch all services, databases, workers, and dev frontends in a unified network:

```bash
# 1. Clone repository
git clone https://github.com/organization/testblind-ai.git
cd testblind-ai

# 2. Initialize environment file
cp .env.example .env

# 3. Build runner sandbox images
docker build -t testblind-runner-python:3.12 -f docker/runners/Dockerfile.python .
docker build -t testblind-runner-node:20 -f docker/runners/Dockerfile.node .

# 4. Launch backend, database, redis, and frontend
docker compose up -d

# 5. Apply database migrations
docker compose exec testblind-api alembic upgrade head
```

### 4.2 Manual / Native Developer Setup

#### Backend Setup (Python + FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run migrations
alembic upgrade head

# Start FastAPI development server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Async Worker Setup
```bash
cd backend
source .venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info -c 4
```

#### Frontend Setup (React + Vite + TypeScript)
```bash
cd frontend
npm install

# Start Vite dev server on port 3000
npm run dev
```

---

## 5. Untrusted Runner Sandbox Configuration

The runner sandbox image is built specifically to contain no host access, run as a non-privileged user, and operate with zero network access during evaluation:

### 5.1 Python Runner Dockerfile (`docker/runners/Dockerfile.python`)
```dockerfile
FROM python:3.12-slim-bookworm

# Create unprivileged runner user
RUN groupadd -g 10001 runner && \
    useradd -u 10001 -g runner -m -s /bin/bash runner

# Install essential test harnesses
RUN pip install --no-cache-dir \
    pytest==8.2.2 \
    pytest-json-report==1.5.0 \
    pytest-timeout==2.3.1 \
    coverage==7.5.3

# Set workspace permissions
WORKDIR /workspace
RUN chown runner:runner /workspace

# Switch permanently to unprivileged runner user
USER runner

# Healthcheck
ENTRYPOINT ["pytest"]
```

---

## 6. Health Checks, Monitoring & Observability

### 6.1 Application Health Endpoints
- **Liveness Probe:** `GET /api/v1/health/live`
  Returns `200 OK` if ASGI server is processing requests.
- **Readiness Probe:** `GET /api/v1/health/ready`
  Validates connectivity to PostgreSQL, Redis, and the Docker runner socket. Returns `503 Service Unavailable` if core dependencies are unreachable.

### 6.2 Metrics & Telemetry
- **Prometheus Metrics:** Exposed at `/metrics` (request latency histograms, active worker jobs, mutation score velocity, sandbox execution durations).
- **Structured JSON Logging:** All services output structured JSON with standard fields (`timestamp`, `level`, `service`, `tenant_id`, `run_id`, `trace_id`).
- **Audit Logging:** Every user action is recorded in PostgreSQL `audit_logs` table for compliance review.

---

## 7. Backup, Disaster Recovery & Maintenance

- **Database Backups:** Daily automated WAL archiving + full nightly pg_dump snapshots stored in geographically redundant S3 buckets with 30-day retention.
- **Zero-Downtime Deployments:** Rolling updates on Kubernetes deployments with `maxSurge: 25%` and `maxUnavailable: 0`.
- **Database Migrations:** All Alembic migrations must be backward-compatible (expand-and-contract pattern) to support zero-downtime rolling deploys.
