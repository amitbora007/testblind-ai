from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.organizations import router as org_router
from app.api.v1.projects import router as project_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.scan_jobs import router as scan_router
from app.api.v1.test_cases import router as test_cases_router
from app.api.v1.test_scenarios import router as test_scenarios_router
from app.api.v1.execution_runs import router as runs_router
from app.api.v1.incidents import router as incident_router
from app.api.v1.reports import router as reports_router
from app.api.v1.ai_insights import router as insights_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.audit import router as audit_router
from app.api.v1.github import router as github_router
from app.api.v1.repositories import router as repositories_router
from app.api.v1.codelab import router as codelab_router

api_router = APIRouter()

# Mount health at root /healthz and /readyz as well as under api_router
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(org_router)
api_router.include_router(project_router)
api_router.include_router(repositories_router)
api_router.include_router(github_router)
api_router.include_router(codelab_router)
api_router.include_router(dashboard_router)
api_router.include_router(scan_router)
api_router.include_router(test_cases_router)
api_router.include_router(test_scenarios_router)
api_router.include_router(runs_router)
api_router.include_router(incident_router)
api_router.include_router(reports_router)
api_router.include_router(insights_router)
api_router.include_router(integrations_router)
api_router.include_router(audit_router)

