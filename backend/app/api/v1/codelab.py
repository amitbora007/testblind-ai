from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import TenantContext, get_tenant_context
from app.schemas.codelab import (
    CodeLabAnalyzeRequest,
    CodeLabAnalyzeResponse,
    CodeLabExecuteRequest,
    CodeLabExecuteResponse,
    CodeLabSynthesizeRequest,
    CodeLabSynthesizeResponse,
)
from app.services.codelab_service import CodeLabService

router = APIRouter(prefix="/codelab", tags=["Standalone Code Lab"])


@router.post("/analyze", response_model=CodeLabAnalyzeResponse)
async def analyze_code_lab_snippet(
    payload: CodeLabAnalyzeRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> CodeLabAnalyzeResponse:
    """
    Performs static AST analysis on user-submitted source snippets without connecting a repository.
    Identifies functions, branches, relational operator boundary conditions, and returns
    source-only AI suggestions (strictly marked as is_executable=False).
    """
    if not payload.source_code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Source code cannot be empty.",
        )

    try:
        response = CodeLabService.analyze(
            source_code=payload.source_code,
            language=payload.language,
            existing_tests=payload.existing_tests,
            expected_behavior=payload.expected_behavior,
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/synthesize", response_model=CodeLabSynthesizeResponse)
async def synthesize_code_lab_tests(
    payload: CodeLabSynthesizeRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> CodeLabSynthesizeResponse:
    """
    Synthesizes targeted edge-case unit tests designed to kill identified mutation candidates.
    Demarcated as an AI test proposal (is_executable=False) awaiting sandbox validation.
    """
    if not payload.source_code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Source code cannot be empty.",
        )

    return CodeLabService.synthesize(
        source_code=payload.source_code,
        language=payload.language,
        target_mutation=payload.target_mutation,
        expected_behavior=payload.expected_behavior,
    )


@router.post("/execute", response_model=CodeLabExecuteResponse)
async def execute_code_lab_sandbox(
    payload: CodeLabExecuteRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> CodeLabExecuteResponse:
    """
    Executes source code and test suite in an isolated ephemeral execution sandbox.
    Captures stdout/stderr, execution duration, and seals result with a cryptographic hash (is_executable=True).
    """
    if not payload.source_code.strip() or not payload.test_code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both source_code and test_code must be provided for sandbox execution.",
        )

    return CodeLabService.execute_sandbox(
        source_code=payload.source_code,
        test_code=payload.test_code,
        language=payload.language,
    )
