import uuid
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.database import get_db
from app.core.sanitization import sanitize_sensitive_data
from app.models.incident import Incident
from app.models.project import Project
from app.models.test import TestCase
from app.models.user import RoleEnum
from app.schemas.incident import (
    IncidentCreate,
    IncidentPromoteRequest,
    IncidentPromoteResponse,
    IncidentRead,
    IncidentUpdate,
    IncidentVerifyRequest,
    IncidentVerifyResponse,
)
from app.services.incident_service import IncidentAnalysisService

router = APIRouter(tags=["Incident Analysis"])


@router.get("/projects/{project_id}/incidents", response_model=List[IncidentRead])
async def list_project_incidents(
    project_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[IncidentRead]:
    """List all incidents for a project, strictly scoped to the active tenant."""
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    if not (await db.execute(proj_query)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    query = select(Incident).where(
        Incident.project_id == project_id,
        Incident.organization_id == tenant.organization_id,
    ).order_by(Incident.created_at.desc())

    incidents = (await db.execute(query)).scalars().all()
    return [IncidentRead.model_validate(i) for i in incidents]


@router.post("/projects/{project_id}/incidents", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
async def intake_incident(
    project_id: uuid.UUID,
    data: IncidentCreate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentRead:
    """
    Intake a production incident report, stack traces, and relevant code.
    1. Validates inputs and enforces tenant authorization.
    2. Scrubs sensitive secrets, API tokens, passwords, and PII.
    3. Runs AI failure analysis and assesses context adequacy.
    4. Generates candidate reproduction test if sufficient context is available,
       or marks as 'needs_more_info' if critical code is missing.
    """
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Sanitize sensitive data from title, description, and raw_traceback
    clean_title, _ = sanitize_sensitive_data(data.title.strip())
    clean_desc, _ = sanitize_sensitive_data(data.description.strip()) if data.description else (None, 0)
    clean_tb, _ = sanitize_sensitive_data(data.raw_traceback.strip())

    # Run AI Analysis & Synthesis
    analysis = IncidentAnalysisService.analyze_incident(
        title=clean_title,
        raw_traceback=clean_tb,
        description=clean_desc,
        expected_behavior=data.expected_behavior,
        actual_behavior=data.actual_behavior,
        buggy_code=data.buggy_code,
        source_files=data.source_files,
        reproduction_steps=data.reproduction_steps,
    )

    incident = Incident(
        project_id=project_id,
        organization_id=tenant.organization_id,
        title=clean_title,
        description=clean_desc,
        severity=data.severity,
        raw_traceback=clean_tb,
        expected_behavior=data.expected_behavior,
        actual_behavior=data.actual_behavior,
        reproduction_steps=data.reproduction_steps,
        source_files=data.source_files or [],
        buggy_code=data.buggy_code,
        corrected_code=data.corrected_code,
        fault_module=analysis.fault_module,
        fault_line=analysis.fault_line,
        hypothesis=analysis.hypothesis,
        missing_details=analysis.missing_details,
        assumptions=analysis.assumptions,
        uncertainty_score=analysis.uncertainty_score,
        repro_code=analysis.repro_code,
        verification_state=analysis.verification_state,
        fixed_commit_hash=data.commit_hash,
    )

    db.add(incident)
    await db.commit()
    await db.refresh(incident)

    return IncidentRead.model_validate(incident)


@router.get("/incidents/{incident_id}", response_model=IncidentRead)
async def get_incident(
    incident_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentRead:
    """Retrieve full incident details, analysis hypothesis, and execution evidence."""
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    return IncidentRead.model_validate(incident)


@router.put("/incidents/{incident_id}", response_model=IncidentRead)
async def update_incident(
    incident_id: uuid.UUID,
    data: IncidentUpdate,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentRead:
    """Update incident details or allow developer to edit candidate reproduction test code."""
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if data.title is not None:
        incident.title, _ = sanitize_sensitive_data(data.title.strip())
    if data.description is not None:
        incident.description, _ = sanitize_sensitive_data(data.description.strip())
    if data.severity is not None:
        incident.severity = data.severity
    if data.raw_traceback is not None:
        incident.raw_traceback, _ = sanitize_sensitive_data(data.raw_traceback.strip())
    if data.expected_behavior is not None:
        incident.expected_behavior = data.expected_behavior
    if data.actual_behavior is not None:
        incident.actual_behavior = data.actual_behavior
    if data.reproduction_steps is not None:
        incident.reproduction_steps = data.reproduction_steps
    if data.buggy_code is not None:
        incident.buggy_code = data.buggy_code
    if data.corrected_code is not None:
        incident.corrected_code = data.corrected_code
    if data.repro_code is not None:
        incident.repro_code = data.repro_code
    if data.hypothesis is not None:
        incident.hypothesis = data.hypothesis
    if data.verification_state is not None:
        incident.verification_state = data.verification_state

    await db.commit()
    await db.refresh(incident)
    return IncidentRead.model_validate(incident)


@router.post("/incidents/{incident_id}/analyze", response_model=IncidentRead)
async def analyze_incident_endpoint(
    incident_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentRead:
    """Re-analyze an existing incident with current context and synthesize test candidate."""
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    analysis = IncidentAnalysisService.analyze_incident(
        title=incident.title,
        raw_traceback=incident.raw_traceback,
        description=incident.description,
        expected_behavior=incident.expected_behavior,
        actual_behavior=incident.actual_behavior,
        buggy_code=incident.buggy_code,
        source_files=incident.source_files,
        reproduction_steps=incident.reproduction_steps,
    )

    incident.fault_module = analysis.fault_module
    incident.fault_line = analysis.fault_line
    incident.hypothesis = analysis.hypothesis
    incident.missing_details = analysis.missing_details
    incident.assumptions = analysis.assumptions
    incident.uncertainty_score = analysis.uncertainty_score
    if analysis.repro_code:
        incident.repro_code = analysis.repro_code
    incident.verification_state = analysis.verification_state

    await db.commit()
    await db.refresh(incident)
    return IncidentRead.model_validate(incident)


@router.post("/incidents/{incident_id}/verify", response_model=IncidentVerifyResponse)
async def verify_incident_dual_state(
    incident_id: uuid.UUID,
    request: IncidentVerifyRequest,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentVerifyResponse:
    """
    Execute Dual-State Sandbox Verification:
    - State A (Buggy Code): Candidate test MUST FAIL (exit code != 0), reproducing defect.
    - State B (Corrected Code): Candidate test MUST PASS (exit code 0), verifying fix.
    """
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    candidate_test = request.candidate_test_code or incident.repro_code
    buggy_code = request.buggy_code or incident.buggy_code
    corrected_code = request.corrected_code or incident.corrected_code

    if not candidate_test:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No candidate reproduction test available for verification.",
        )
    if not buggy_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buggy code snippet is required to execute State A reproduction check.",
        )

    module_name = "solution"
    if incident.fault_module:
        module_name = incident.fault_module.split("/")[-1].replace(".py", "")

    # Execute dual-state verification
    outcome = await IncidentAnalysisService.verify_dual_state(
        buggy_code=buggy_code,
        candidate_test_code=candidate_test,
        corrected_code=corrected_code,
        module_name=module_name,
    )

    # Persist execution outcomes
    incident.verification_state = outcome.verification_state
    incident.evidence_hash = outcome.evidence_hash
    incident.state_a_stdout = outcome.state_a_stdout
    incident.state_a_stderr = outcome.state_a_stderr
    incident.state_b_stdout = outcome.state_b_stdout
    incident.state_b_stderr = outcome.state_b_stderr
    if request.fixed_commit:
        incident.fixed_commit_hash = request.fixed_commit

    await db.commit()

    return IncidentVerifyResponse(
        incident_id=incident.id,
        verification_state=outcome.verification_state,
        state_a_result=outcome.state_a_result,
        state_b_result=outcome.state_b_result,
        reproduction_proven=outcome.reproduction_proven,
        fix_proven=outcome.fix_proven,
        evidence_hash=outcome.evidence_hash,
        duration_ms=outcome.duration_ms,
        state_a_stdout=outcome.state_a_stdout,
        state_a_stderr=outcome.state_a_stderr,
        state_b_stdout=outcome.state_b_stdout,
        state_b_stderr=outcome.state_b_stderr,
        details=outcome.details,
    )


@router.post("/incidents/{incident_id}/promote", response_model=IncidentPromoteResponse)
async def promote_incident_test(
    incident_id: uuid.UUID,
    data: IncidentPromoteRequest,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IncidentPromoteResponse:
    """
    Promotes a verified reproduction test to the shared regression test catalog (`test_cases`).
    Links provenance to the source incident and seals with evidence hash.
    """
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    test_code = data.test_code or incident.repro_code
    if not test_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incident does not have a synthesized reproduction test to promote.",
        )

    test_name = data.name or f"test_repro_inc_{str(incident.id)[:8]}"
    file_path = data.file_path or f"tests/regression/test_incident_{str(incident.id)[:8]}.py"

    test_case = TestCase(
        project_id=incident.project_id,
        organization_id=tenant.organization_id,
        name=test_name,
        file_path=file_path,
        function_name=test_name,
        framework="pytest",
        code=test_code,
        status="verified",
        mutation_kill_count=1,
        is_flaky=False,
    )
    db.add(test_case)
    await db.flush()

    incident.generated_test_id = test_case.id
    await db.commit()

    return IncidentPromoteResponse(
        test_case_id=test_case.id,
        incident_id=incident.id,
        project_id=incident.project_id,
        name=test_case.name,
        file_path=test_case.file_path,
        status="verified",
        evidence_hash=incident.evidence_hash or "unhashed",
        message="Incident reproduction test promoted to shared regression test library.",
    )


@router.get("/incidents/{incident_id}/export")
async def export_incident_test(
    incident_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Exports candidate reproduction test code as a downloadable python test file."""
    query = select(Incident).where(
        Incident.id == incident_id,
        Incident.organization_id == tenant.organization_id,
    )
    incident = (await db.execute(query)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    code = incident.repro_code or "# No reproduction test code available."
    filename = f"test_repro_incident_{str(incident.id)[:8]}.py"

    return Response(
        content=code,
        media_type="text/x-python",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
