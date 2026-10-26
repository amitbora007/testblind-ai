import os
import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_tenant_context, require_role
from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project, Repository
from app.models.user import RoleEnum
from app.schemas.repository import RepositoryStructureRead, ZipUploadResponse
from app.services.archive_service import (
    ArchiveSecurityError,
    InvalidArchiveError,
    ProjectStructureDetector,
    RetentionManager,
    SafeArchiveExtractor,
    ZipBombSecurityError,
    ZipSlipSecurityError,
)

router = APIRouter(prefix="/projects/{project_id}/repositories", tags=["Repositories"])


@router.post("/upload-zip", response_model=ZipUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_repository_zip(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ZipUploadResponse:
    """
    Safely ingests and extracts an untrusted repository ZIP archive.
    Enforces MIME / magic-byte verification, Zip Slip path traversal defenses,
    Zip Bomb ratio/size limits, and automated language & test runner detection.
    """
    # 1. Verify project exists and belongs to active tenant
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == tenant.organization_id,
    )
    project = (await db.execute(proj_query)).scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # 2. File extension validation
    filename = file.filename or "repository.zip"
    if not filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format ({filename}). Only standard .zip archives are supported.",
        )

    # 3. Read content into memory with size check
    archive_bytes = await file.read()
    if len(archive_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(archive_bytes) > settings.UPLOAD_MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded file exceeds maximum limit of {settings.UPLOAD_MAX_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # 4. Allocate isolated tenant scratch directory
    repo_id = uuid.uuid4()
    scratch_dir = RetentionManager.get_repo_storage_path(
        organization_id=str(tenant.organization_id),
        repository_id=str(repo_id),
    )

    # 5. Extract with strict Zip Slip & Zip Bomb defenses
    try:
        extracted_files = SafeArchiveExtractor.inspect_and_extract(
            archive_bytes=archive_bytes,
            destination_dir=str(scratch_dir),
            max_upload_size=settings.UPLOAD_MAX_SIZE_BYTES,
        )
    except ZipSlipSecurityError as e:
        RetentionManager.purge_repository_scratch(str(tenant.organization_id), str(repo_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Alert: Malicious path traversal (Zip Slip) detected in archive: {str(e)}",
        )
    except ZipBombSecurityError as e:
        RetentionManager.purge_repository_scratch(str(tenant.organization_id), str(repo_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Alert: Archive rejected by Zip Bomb defense: {str(e)}",
        )
    except (InvalidArchiveError, ArchiveSecurityError) as e:
        RetentionManager.purge_repository_scratch(str(tenant.organization_id), str(repo_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archive validation failure: {str(e)}",
        )

    # 6. Analyze project structure, language, and test runners
    try:
        structure = ProjectStructureDetector.analyze(str(scratch_dir))
    except Exception as e:
        structure = None

    detected_lang = structure.primary_language if structure else "unknown"
    detected_runner = structure.detected_test_runner if structure else "custom"
    suggested_cmd = structure.suggested_test_command if structure else "make test"
    detected_langs = structure.detected_languages if structure else []
    total_files = structure.total_files if structure else len(extracted_files)
    source_files = structure.source_files if structure else 0
    test_files = structure.test_files if structure else 0
    config_files = structure.config_files if structure else []
    manifest = structure.file_manifest if structure else extracted_files[:50]

    # 7. Persist repository record
    repo = Repository(
        id=repo_id,
        project_id=project.id,
        organization_id=tenant.organization_id,
        repo_type="zip",
        repo_url=f"upload://{filename}",
        default_branch="snapshot",
        zip_artifact_path=str(scratch_dir),
    )
    db.add(repo)

    # Update project framework if auto-detected
    if detected_runner and detected_runner != "custom":
        project.framework = detected_runner

    await db.commit()
    await db.refresh(repo)

    return ZipUploadResponse(
        repository_id=repo.id,
        project_id=project.id,
        repo_type="zip",
        filename=filename,
        file_size_bytes=len(archive_bytes),
        detected_language=detected_lang,
        detected_languages=detected_langs,
        detected_test_runner=detected_runner,
        suggested_test_command=suggested_cmd,
        total_files=total_files,
        source_files=source_files,
        test_files=test_files,
        config_files=config_files,
        file_manifest=manifest,
        message="Archive safely extracted and repository structure verified.",
    )


@router.delete("/{repo_id}/upload", status_code=status.HTTP_200_OK)
async def delete_repository_upload(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(require_role(RoleEnum.ENGINEER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Purges uploaded archive scratch folder and cleans up tenant storage."""
    query = select(Repository).where(
        Repository.id == repo_id,
        Repository.project_id == project_id,
        Repository.organization_id == tenant.organization_id,
    )
    repo = (await db.execute(query)).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    # Purge scratch files
    RetentionManager.purge_repository_scratch(str(tenant.organization_id), str(repo.id))

    await db.delete(repo)
    await db.commit()

    return {"status": "success", "message": "Uploaded repository scratch files successfully purged."}


@router.get("/{repo_id}/structure", response_model=RepositoryStructureRead)
async def get_repository_structure(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepositoryStructureRead:
    """Inspects the extracted structure of an uploaded repository."""
    query = select(Repository).where(
        Repository.id == repo_id,
        Repository.project_id == project_id,
        Repository.organization_id == tenant.organization_id,
    )
    repo = (await db.execute(query)).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    if not repo.zip_artifact_path or not os.path.exists(repo.zip_artifact_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository scratch files have expired or been removed.",
        )

    structure = ProjectStructureDetector.analyze(repo.zip_artifact_path)

    return RepositoryStructureRead(
        repository_id=repo.id,
        project_id=project_id,
        repo_type=repo.repo_type,
        detected_language=structure.primary_language,
        detected_test_runner=structure.detected_test_runner,
        suggested_test_command=structure.suggested_test_command,
        total_files=structure.total_files,
        source_files=structure.source_files,
        test_files=structure.test_files,
        file_manifest=structure.file_manifest,
    )
