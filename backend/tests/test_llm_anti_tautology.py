import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings
from app.services.llm_service import ASTAssertionAuditor, LLMTestSynthesizer
from app.services.mutation_engine import MutantSpec


# =============================================================================
# 1. AST Assertion Auditor Tests
# =============================================================================

def test_auditor_rejects_empty_code():
    is_valid, reason = ASTAssertionAuditor.audit_test_code("")
    assert not is_valid
    assert "empty" in reason.lower()


def test_auditor_rejects_syntax_error():
    is_valid, reason = ASTAssertionAuditor.audit_test_code("def test_broken(: pass")
    assert not is_valid
    assert "syntax error" in reason.lower()


def test_auditor_rejects_no_assertions():
    code = (
        "def test_no_assertions():\n"
        "    x = 10 + 20\n"
        "    print(x)\n"
    )
    is_valid, reason = ASTAssertionAuditor.audit_test_code(code)
    assert not is_valid
    assert "zero assertions" in reason.lower()


@pytest.mark.parametrize("tautology_line", [
    "assert True",
    "assert not False",
    "assert res is not None or res is None",
    "assert res is None or res is not None",
    "assert x or True",
    "assert True or x",
    "assert 1 == 1",
    "assert 'abc' == 'abc'",
    "assert e is not None or True",
])
def test_auditor_strictly_rejects_tautologies(tautology_line):
    code = (
        "def test_candidate():\n"
        f"    {tautology_line}\n"
    )
    is_valid, reason = ASTAssertionAuditor.audit_test_code(code)
    assert not is_valid, f"Auditor failed to reject tautology: {tautology_line}"
    assert "tautological" in reason.lower() or "constant" in reason.lower()


@pytest.mark.parametrize("valid_assertion", [
    "assert calculate_discount(100.0) == 0.05",
    "assert result is not None",
    "assert len(items) == 3",
    "assert user.is_authenticated",
    "assert balance >= 0",
])
def test_auditor_accepts_valid_domain_assertions(valid_assertion):
    code = (
        "def test_candidate():\n"
        f"    {valid_assertion}\n"
    )
    is_valid, reason = ASTAssertionAuditor.audit_test_code(code)
    assert is_valid, f"Auditor rejected valid assertion: {valid_assertion} ({reason})"
    assert "passed" in reason.lower()


def test_auditor_accepts_pytest_raises():
    code = (
        "import pytest\n"
        "def test_raises_exception():\n"
        "    with pytest.raises(ValueError):\n"
        "        int('invalid')\n"
    )
    is_valid, reason = ASTAssertionAuditor.audit_test_code(code)
    assert is_valid, f"Auditor rejected pytest.raises context: {reason}"


# =============================================================================
# 2. Local AST Synthesizer & Boundary Extraction Tests
# =============================================================================

SAMPLE_SOURCE = (
    "def calculate_tier_discount(order_total: float, tier: str = 'BRONZE') -> float:\n"
    "    if order_total > 100.0:\n"
    "        return 0.15\n"
    "    return 0.05\n"
)

def test_extract_comparison_threshold():
    threshold = LLMTestSynthesizer._extract_comparison_threshold(SAMPLE_SOURCE, 2)
    assert threshold == 100.0


def test_local_synthesizer_generates_verified_non_tautological_test():
    mut = MutantSpec(
        id="mut_ror_100",
        file_path="solution.py",
        line_number=2,
        col_offset=7,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if order_total > 100.0:",
        mutated_snippet="if order_total >= 100.0:",
        description="Relational > to >=",
    )
    test_code = LLMTestSynthesizer.synthesize_killing_test(SAMPLE_SOURCE, mut)

    # Must contain valid assertion
    is_valid, reason = ASTAssertionAuditor.audit_test_code(test_code)
    assert is_valid, f"Synthesized test failed assertion audit: {reason}"

    # Must NOT contain old tautology
    assert "assert result is not None or result is None" not in test_code
    assert "assert e is not None or True" not in test_code
    assert "assert result is not None" in test_code


# =============================================================================
# 3. Multi-Provider LLM Async Synthesis Tests
# =============================================================================

@pytest.mark.asyncio
async def test_synthesize_async_anthropic_provider():
    mut = MutantSpec(
        id="mut_1",
        file_path="solution.py",
        line_number=2,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if x > 10:",
        mutated_snippet="if x >= 10:",
        description="test",
    )

    mock_llm_code = (
        "import pytest\n"
        "from solution import calculate_tier_discount\n\n"
        "def test_boundary_exact():\n"
        "    assert calculate_tier_discount(100.0) == 0.05\n"
    )

    fake_response = MagicMock()
    fake_response.json.return_value = {
        "content": [{"text": f"Here is the test:\n```python\n{mock_llm_code}\n```"}]
    }
    fake_response.raise_for_status = MagicMock()

    with patch.object(settings, "DEFAULT_LLM_PROVIDER", "anthropic"), \
         patch.object(settings, "ANTHROPIC_API_KEY", "sk-ant-test1234"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = fake_response

        res = await LLMTestSynthesizer.synthesize_killing_test_async(SAMPLE_SOURCE, mut)
        assert "assert calculate_tier_discount(100.0) == 0.05" in res


@pytest.mark.asyncio
async def test_synthesize_async_openai_provider():
    mut = MutantSpec(
        id="mut_1",
        file_path="solution.py",
        line_number=2,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if x > 10:",
        mutated_snippet="if x >= 10:",
        description="test",
    )

    mock_llm_code = (
        "import pytest\n"
        "from solution import calculate_tier_discount\n\n"
        "def test_boundary_openai():\n"
        "    assert calculate_tier_discount(100.0) == 0.05\n"
    )

    fake_response = MagicMock()
    fake_response.json.return_value = {
        "choices": [{"message": {"content": f"```python\n{mock_llm_code}\n```"}}]
    }
    fake_response.raise_for_status = MagicMock()

    with patch.object(settings, "DEFAULT_LLM_PROVIDER", "openai"), \
         patch.object(settings, "OPENAI_API_KEY", "sk-proj-test1234"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = fake_response

        res = await LLMTestSynthesizer.synthesize_killing_test_async(SAMPLE_SOURCE, mut)
        assert "test_boundary_openai" in res


@pytest.mark.asyncio
async def test_synthesize_async_gemini_provider():
    mut = MutantSpec(
        id="mut_1",
        file_path="solution.py",
        line_number=2,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if x > 10:",
        mutated_snippet="if x >= 10:",
        description="test",
    )

    mock_llm_code = (
        "import pytest\n"
        "from solution import calculate_tier_discount\n\n"
        "def test_boundary_gemini():\n"
        "    assert calculate_tier_discount(100.0) == 0.05\n"
    )

    fake_response = MagicMock()
    fake_response.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": f"```python\n{mock_llm_code}\n```"}]}}]
    }
    fake_response.raise_for_status = MagicMock()

    with patch.object(settings, "DEFAULT_LLM_PROVIDER", "gemini"), \
         patch.object(settings, "GEMINI_API_KEY", "AIzaSy-test"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = fake_response

        res = await LLMTestSynthesizer.synthesize_killing_test_async(SAMPLE_SOURCE, mut)
        assert "test_boundary_gemini" in res


@pytest.mark.asyncio
async def test_synthesize_async_fallback_when_cloud_fails():
    mut = MutantSpec(
        id="mut_1",
        file_path="solution.py",
        line_number=2,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if x > 10:",
        mutated_snippet="if x >= 10:",
        description="test",
    )

    with patch.object(settings, "DEFAULT_LLM_PROVIDER", "anthropic"), \
         patch.object(settings, "ANTHROPIC_API_KEY", "sk-ant-test"), \
         patch("httpx.AsyncClient.post", side_effect=Exception("API Connection Refused")):
        # Should gracefully fall back to local synthesizer
        res = await LLMTestSynthesizer.synthesize_killing_test_async(SAMPLE_SOURCE, mut)
        assert "def test_" in res
        assert "assert result is not None" in res
