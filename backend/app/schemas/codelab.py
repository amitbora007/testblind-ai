from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CodeLabAnalyzeRequest(BaseModel):
    source_code: str = Field(..., min_length=1, max_length=50_000, description="Source code snippet under test.")
    language: str = Field("python", description="Programming language: python, typescript, go, etc.")
    existing_tests: Optional[str] = Field(None, max_length=50_000, description="Optional existing unit tests.")
    expected_behavior: Optional[str] = Field(None, max_length=5_000, description="Domain invariants or expected behavior.")


class MutationCandidate(BaseModel):
    id: str
    line_number: int
    operator_type: str  # ROR, AOR, LCR, BSR
    original_operator: str
    mutated_operator: str
    original_snippet: str
    mutated_snippet: str
    description: str


class CodeLabSuggestion(BaseModel):
    title: str
    description: str
    category: str
    target_line: Optional[int] = None
    severity: str = "medium"


class CodeLabAnalyzeResponse(BaseModel):
    language: str
    ast_nodes_count: int
    functions: List[Dict[str, Any]]
    branches_count: int
    mutation_candidates: List[MutationCandidate]
    suggestions: List[CodeLabSuggestion]
    is_executable: bool = Field(False, description="Source-only analysis; not an executed test result.")


class CodeLabSynthesizeRequest(BaseModel):
    source_code: str = Field(..., min_length=1, max_length=50_000)
    language: str = "python"
    target_mutation: Optional[Dict[str, Any]] = None
    expected_behavior: Optional[str] = None


class CodeLabSynthesizeResponse(BaseModel):
    synthesized_test_code: str
    target_mutant: Dict[str, Any]
    rationale: str
    assertion_type: str
    is_executable: bool = Field(False, description="Generated AI test proposal; requires execution verification.")


class CodeLabExecuteRequest(BaseModel):
    source_code: str = Field(..., min_length=1, max_length=50_000)
    test_code: str = Field(..., min_length=1, max_length=50_000)
    language: str = "python"


class CodeLabExecuteResponse(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    mutant_status: str  # KILLED, SURVIVED, ERROR
    execution_hash: str
    is_executable: bool = Field(True, description="Real execution evidence sealed with cryptographic hash.")
    verified: bool
    baseline_passed: bool
    mutant_killed: bool
