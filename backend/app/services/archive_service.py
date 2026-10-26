import io
import os
import shutil
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


class ArchiveSecurityError(Exception):
    """Base exception for archive security violations."""
    pass


class InvalidArchiveError(ArchiveSecurityError):
    """Raised when an uploaded file is not a valid ZIP archive."""
    pass


class ZipSlipSecurityError(ArchiveSecurityError):
    """Raised when an archive member attempts directory traversal."""
    pass


class ZipBombSecurityError(ArchiveSecurityError):
    """Raised when an archive exceeds decompression ratios or total size limits."""
    pass


@dataclass
class ProjectStructure:
    primary_language: str
    detected_languages: List[str]
    detected_test_runner: str
    suggested_test_command: str
    total_files: int
    source_files: int
    test_files: int
    has_git: bool
    config_files: List[str]
    file_manifest: List[str] = field(default_factory=list)


class SafeArchiveExtractor:
    """
    Safely inspects and extracts untrusted ZIP archives, enforcing
    Zip Slip, Zip Bomb, and magic-byte security constraints.
    """

    ZIP_MAGIC_BYTES = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
    MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB
    MAX_FILES_COUNT = 10_000
    MAX_COMPRESSION_RATIO = 100.0  # Uncompressed to compressed ratio

    @classmethod
    def validate_magic_bytes(cls, content: bytes) -> None:
        """Verify standard ZIP magic bytes."""
        if len(content) < 4:
            raise InvalidArchiveError("File is too small to be a valid ZIP archive.")
        header = content[:4]
        if not any(content.startswith(magic) for magic in cls.ZIP_MAGIC_BYTES):
            raise InvalidArchiveError(
                f"Invalid file signature ({header!r}). Expected standard ZIP magic bytes (PK\\x03\\x04)."
            )

    @classmethod
    def inspect_and_extract(
        cls,
        archive_bytes: bytes,
        destination_dir: str,
        max_upload_size: int = 100 * 1024 * 1024,
    ) -> List[str]:
        """
        Validate and unpack archive into destination_dir with strict path traversal defenses.
        Returns a list of extracted relative file paths.
        """
        if len(archive_bytes) > max_upload_size:
            raise ArchiveSecurityError(
                f"Archive size ({len(archive_bytes)} bytes) exceeds maximum limit of {max_upload_size} bytes."
            )

        cls.validate_magic_bytes(archive_bytes)

        try:
            zip_buffer = io.BytesIO(archive_bytes)
            with zipfile.ZipFile(zip_buffer, "r") as zf:
                # 1. Pre-extraction safety audit
                infolist = zf.infolist()
                if len(infolist) > cls.MAX_FILES_COUNT:
                    raise ZipBombSecurityError(
                        f"Archive contains {len(infolist)} files, exceeding maximum allowed limit ({cls.MAX_FILES_COUNT})."
                    )

                total_uncompressed = 0
                compressed_size = max(len(archive_bytes), 1)

                dest_abs = os.path.abspath(destination_dir)
                os.makedirs(dest_abs, exist_ok=True)

                for info in infolist:
                    # Enforce cumulative size limit
                    total_uncompressed += info.file_size
                    if total_uncompressed > cls.MAX_UNCOMPRESSED_BYTES:
                        raise ZipBombSecurityError(
                            f"Extracted archive size exceeds maximum limit of {cls.MAX_UNCOMPRESSED_BYTES // (1024*1024)} MB."
                        )

                    # Check compression ratio per entry
                    if info.compress_size > 0:
                        ratio = info.file_size / info.compress_size
                        if ratio > cls.MAX_COMPRESSION_RATIO and info.file_size > 10 * 1024 * 1024:
                            raise ZipBombSecurityError(
                                f"Suspicious compression ratio ({ratio:.1f}:1) detected for {info.filename}."
                            )

                    # 2. Path Traversal & Zip Slip check
                    norm_name = os.path.normpath(info.filename)
                    if norm_name.startswith("..") or os.path.isabs(info.filename) or "\x00" in info.filename:
                        raise ZipSlipSecurityError(
                            f"Path traversal detected in archive entry: {info.filename}"
                        )

                    target_path = os.path.abspath(os.path.join(dest_abs, info.filename))
                    try:
                        common = os.path.commonpath([dest_abs, target_path])
                    except ValueError:
                        raise ZipSlipSecurityError(
                            f"Archive path traversal across drives or boundaries detected: {info.filename}"
                        )

                    if common != dest_abs:
                        raise ZipSlipSecurityError(
                            f"Archive entry escapes destination root: {info.filename}"
                        )

                    # Reject symlink traversal
                    # In standard ZIP external attributes, symlinks have 0o120000 in unix mode bits
                    unix_mode = info.external_attr >> 16
                    if (unix_mode & 0o120000) == 0o120000:
                        raise ZipSlipSecurityError(
                            f"Symbolic link detected in archive entry ({info.filename}). Symlinks are rejected for security."
                        )

                # 3. Safe Extraction
                extracted_files: List[str] = []
                for info in infolist:
                    target_path = os.path.abspath(os.path.join(dest_abs, info.filename))
                    if info.is_dir():
                        os.makedirs(target_path, exist_ok=True)
                        continue

                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with zf.open(info) as src, open(target_path, "wb") as dst:
                        shutil.copyfileobj(src, dst)

                    rel_path = os.path.relpath(target_path, dest_abs)
                    extracted_files.append(rel_path)

                return extracted_files

        except zipfile.BadZipFile as e:
            raise InvalidArchiveError(f"Corrupted or invalid ZIP archive: {str(e)}")


class ProjectStructureDetector:
    """
    Analyzes an unpacked repository directory to detect supported languages,
    test runners, entry points, and project layout.
    """

    LANGUAGE_EXTENSIONS = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".go": "go",
        ".java": "java",
        ".rs": "rust",
    }

    IGNORE_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".pytest_cache"}

    @classmethod
    def analyze(cls, root_dir: str) -> ProjectStructure:
        root_path = Path(root_dir)
        if not root_path.exists() or not root_path.is_dir():
            raise ValueError(f"Directory {root_dir} does not exist.")

        language_counts: Dict[str, int] = {}
        config_files: List[str] = []
        file_manifest: List[str] = []
        total_files = 0
        source_files = 0
        test_files = 0
        has_git = (root_path / ".git").exists()

        for current_root, dirs, files in os.walk(root_path):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if d not in cls.IGNORE_DIRS]

            for file in files:
                rel_path = os.path.relpath(os.path.join(current_root, file), root_dir)
                total_files += 1

                if len(file_manifest) < 60:
                    file_manifest.append(rel_path)

                ext = Path(file).suffix.lower()
                lang = cls.LANGUAGE_EXTENSIONS.get(ext)
                if lang:
                    language_counts[lang] = language_counts.get(lang, 0) + 1
                    source_files += 1

                # Test file detection
                lower_file = file.lower()
                if (
                    lower_file.startswith("test_")
                    or lower_file.endswith("_test.py")
                    or lower_file.endswith(".test.ts")
                    or lower_file.endswith(".spec.ts")
                    or lower_file.endswith(".test.js")
                    or lower_file.endswith(".spec.js")
                    or lower_file.endswith("_test.go")
                    or lower_file.endswith("test.java")
                ):
                    test_files += 1

                # Known configuration manifests
                if file in {
                    "package.json",
                    "tsconfig.json",
                    "pyproject.toml",
                    "setup.py",
                    "requirements.txt",
                    "Pipfile",
                    "go.mod",
                    "pom.xml",
                    "build.gradle",
                    "pytest.ini",
                    "jest.config.js",
                    "jest.config.ts",
                    "vitest.config.ts",
                }:
                    config_files.append(rel_path)

        # Determine primary language
        if language_counts:
            primary_language = max(language_counts.items(), key=lambda item: item[1])[0]
            detected_languages = sorted(language_counts.keys(), key=lambda k: -language_counts[k])
        else:
            primary_language = "unknown"
            detected_languages = []

        # Determine test runner and command
        runner, command = cls._detect_test_runner(root_path, primary_language, config_files)

        return ProjectStructure(
            primary_language=primary_language,
            detected_languages=detected_languages,
            detected_test_runner=runner,
            suggested_test_command=command,
            total_files=total_files,
            source_files=source_files,
            test_files=test_files,
            has_git=has_git,
            config_files=config_files,
            file_manifest=file_manifest,
        )

    @classmethod
    def _detect_test_runner(
        cls,
        root_path: Path,
        primary_lang: str,
        config_files: List[str],
    ) -> Tuple[str, str]:
        configs_set = set(os.path.basename(c) for c in config_files)

        if primary_lang == "python":
            # Check requirements.txt or pyproject.toml contents if available
            return "pytest", "pytest --tb=short tests/"

        if primary_lang in {"typescript", "javascript"}:
            if "vitest.config.ts" in configs_set or "vitest.config.js" in configs_set:
                return "vitest", "npx vitest run"
            if "jest.config.js" in configs_set or "jest.config.ts" in configs_set:
                return "jest", "npm test"
            return "jest", "npm test"

        if primary_lang == "go":
            return "go test", "go test -v ./..."

        if primary_lang == "java":
            if "pom.xml" in configs_set:
                return "maven", "mvn test"
            if "build.gradle" in configs_set:
                return "gradle", "./gradlew test"
            return "junit", "mvn test"

        return "custom", "make test"


class RetentionManager:
    """Manages ephemeral uploaded archives and directory lifecycle."""

    BASE_STORAGE_PATH = Path("storage/tenants")

    @classmethod
    def get_repo_storage_path(cls, organization_id: str, repository_id: str) -> Path:
        target = cls.BASE_STORAGE_PATH / str(organization_id) / "repositories" / str(repository_id)
        target.mkdir(parents=True, exist_ok=True)
        return target

    @classmethod
    def purge_repository_scratch(cls, organization_id: str, repository_id: str) -> bool:
        target = cls.BASE_STORAGE_PATH / str(organization_id) / "repositories" / str(repository_id)
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
            return True
        return False

    @classmethod
    def cleanup_expired_scratch(cls, retention_hours: int = 24) -> int:
        """Purge directories older than retention_hours. Returns count of deleted dirs."""
        if not cls.BASE_STORAGE_PATH.exists():
            return 0

        cutoff = time.time() - (retention_hours * 3600)
        purged = 0

        for current_root, dirs, _ in os.walk(cls.BASE_STORAGE_PATH):
            for d in list(dirs):
                dir_path = Path(current_root) / d
                try:
                    mtime = dir_path.stat().st_mtime
                    if mtime < cutoff:
                        shutil.rmtree(dir_path, ignore_errors=True)
                        purged += 1
                        dirs.remove(d)
                except OSError:
                    pass

        return purged
