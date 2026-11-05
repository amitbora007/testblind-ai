import pytest
from unittest.mock import patch, MagicMock
from app.services.mutation_engine import JSTSMutationEngine, ASTMutationEngine, MutantSpec
from app.services.llm_service import ASTAssertionAuditor, LLMTestSynthesizer
from app.services.validation_service import DualStateTestValidator
from app.services.codelab_service import CodeLabService
from app.services.discovery_service import TestDiscoveryService
import tempfile
from pathlib import Path


# =============================================================================
# 1. JSTSMutationEngine Tests (ROR, AOR, LCR, BSR, String/Comment Immunity)
# =============================================================================

def test_jsts_mutation_engine_ror():
    ts_code = """
function checkTier(score: number): boolean {
    if (score >= 100) {
        return true;
    }
    return score === 50;
}
"""
    mutants = JSTSMutationEngine.generate_mutants_for_source(ts_code, "auth.ts")
    assert len(mutants) > 0
    operators = [m.operator for m in mutants]
    assert "ROR" in operators

    # Check >= mutated to >
    ror_gte = [m for m in mutants if ">=" in m.original_token or ">=" in m.original_snippet]
    assert len(ror_gte) > 0
    assert any(">" in m.mutated_token for m in ror_gte)

    # Check === mutated to !==
    ror_eq = [m for m in mutants if "===" in m.original_token or "===" in m.original_snippet]
    assert len(ror_eq) > 0
    assert any("!==" in m.mutated_token for m in ror_eq)


def test_jsts_mutation_engine_aor():
    js_code = """
function calculateTotal(price, taxRate) {
    const tax = price * taxRate;
    return price + tax;
}
"""
    mutants = JSTSMutationEngine.generate_mutants_for_source(js_code, "calc.js")
    aor_mutants = [m for m in mutants if m.operator == "AOR"]
    assert len(aor_mutants) > 0
    assert any("-" in m.mutated_token for m in aor_mutants)
    assert any("/" in m.mutated_token for m in aor_mutants)


def test_jsts_mutation_engine_lcr():
    ts_code = """
function isEligible(isAuth: boolean, hasPermission: boolean): boolean {
    return isAuth && hasPermission;
}
"""
    mutants = JSTSMutationEngine.generate_mutants_for_source(ts_code, "perm.ts")
    lcr_mutants = [m for m in mutants if m.operator == "LCR"]
    assert len(lcr_mutants) > 0
    assert any("||" in m.mutated_token for m in lcr_mutants)


def test_jsts_mutation_engine_bsr():
    ts_code = """
function isAvailable(limit: number): boolean {
    if (limit > 50) {
        return true;
    }
    return false;
}
"""
    mutants = JSTSMutationEngine.generate_mutants_for_source(ts_code, "limit.ts")
    bsr_mutants = [m for m in mutants if m.operator == "BSR"]
    assert len(bsr_mutants) > 0
    # Boundary shift: 50 -> 51 or 49
    assert any("51" in m.mutated_token or "49" in m.mutated_token for m in bsr_mutants)
    # Boolean flip: true -> false or false -> true
    assert any("false" in m.mutated_token or "true" in m.mutated_token for m in bsr_mutants)


def test_jsts_string_and_comment_immunity():
    code_with_strings = '''
// Comment with > and === and &&
/* Multi-line
   comment with || and +
*/
function logStatus(msg: string): string {
    const label = "score > 100 && tier === 'gold'";
    return label;
}
'''
    mutants = JSTSMutationEngine.generate_mutants_for_source(code_with_strings, "status.ts")
    # All operators are inside comments or string literals; zero mutants should be created
    assert len(mutants) == 0


def test_jsts_jsx_tag_protection():
    jsx_code = """
import React from 'react';

export function StatusCard({ isReady, count }) {
    if (count > 0 && isReady) {
        return <div className="ready"><span>Active</span></div>;
    }
    return <p>Inactive</p>;
}
"""
    mutants = JSTSMutationEngine.generate_mutants_for_source(jsx_code, "StatusCard.tsx")
    assert len(mutants) > 0
    # Every mutant must come only from the conditional logic on line 5, never from JSX tags
    for m in mutants:
        assert m.line_number == 5
        assert m.original_token in (">", "&&", "0")


def test_polyglot_ast_mutation_engine_auto_detection():
    py_code = "def is_positive(x: int) -> bool:\n    return x > 0\n"
    ts_code = "export function isPositive(x: number): boolean {\n    return x > 0;\n}\n"

    py_mutants = ASTMutationEngine.generate_mutants_for_source(py_code, "check.py", language="auto")
    assert len(py_mutants) > 0
    assert py_mutants[0].operator == "ROR"

    ts_mutants = ASTMutationEngine.generate_mutants_for_source(ts_code, "check.ts", language="auto")
    assert len(ts_mutants) > 0
    assert ts_mutants[0].operator == "ROR"


# =============================================================================
# 2. AST Assertion Auditor Tests (JS/TS expect() validations & tautology rejection)
# =============================================================================

@pytest.mark.parametrize("valid_jsts_test", [
    """
    import { describe, it, expect } from 'vitest';
    import { calculateDiscount } from './solution';

    describe('calculateDiscount', () => {
        it('validates 100 threshold', () => {
            expect(calculateDiscount(100, 'PLATINUM')).toBe(0.05);
        });
    });
    """,
    """
    test('boundary verification', () => {
        expect(isAuthorized(user)).toBe(true);
        expect(user.roles).toContain('admin');
    });
    """,
    """
    it('throws error on negative total', () => {
        expect(() => calculateTotal(-1)).toThrow('Invalid total');
    });
    """,
])
def test_auditor_accepts_valid_jsts_tests(valid_jsts_test):
    is_valid, reason = ASTAssertionAuditor.audit_test_code(valid_jsts_test, language="typescript")
    assert is_valid, f"Auditor rejected valid JS/TS test: {reason}"
    assert "passed" in reason.lower()


@pytest.mark.parametrize("tautology_jsts_test", [
    # expect(true).toBe(true)
    """
    it('tautology test 1', () => {
        expect(true).toBe(true);
    });
    """,
    # expect(true).toBeTruthy()
    """
    it('tautology test 2', () => {
        expect(true).toBeTruthy();
    });
    """,
    # expect(false).toBe(false)
    """
    it('tautology test 3', () => {
        expect(false).toBe(false);
    });
    """,
    # expect(1).toBe(1)
    """
    it('tautology test 4', () => {
        expect(1).toBe(1);
    });
    """,
    # expect('abc').toBe('abc')
    """
    it('tautology test 5', () => {
        expect('abc').toBe('abc');
    });
    """,
    # expect(x || true).toBe(true)
    """
    it('tautology test 6', () => {
        expect(x || true).toBe(true);
    });
    """,
])
def test_auditor_rejects_jsts_tautologies(tautology_jsts_test):
    is_valid, reason = ASTAssertionAuditor.audit_test_code(tautology_jsts_test, language="typescript")
    assert not is_valid, f"Auditor failed to reject tautology: {tautology_jsts_test}"
    assert "tautolog" in reason.lower() or "constant" in reason.lower()


def test_auditor_rejects_jsts_zero_assertions():
    code = """
    describe('no assertions', () => {
        it('does nothing', () => {
            const x = 10 + 20;
            console.log(x);
        });
    });
    """
    is_valid, reason = ASTAssertionAuditor.audit_test_code(code, language="javascript")
    assert not is_valid
    assert "zero assertions" in reason.lower()


# =============================================================================
# 3. LLM Test Synthesizer Tests
# =============================================================================

def test_synthesize_jsts_test():
    mutant = MutantSpec(
        id="MUT-TEST-JS-01",
        file_path="src/utils/pricing.ts",
        line_number=12,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if (orderTotal > 100) {",
        mutated_snippet="if (orderTotal >= 100) {",
        description="ROR > to >=",
    )
    test_code = LLMTestSynthesizer._synthesize_jsts_test(
        mutant=mutant,
        source_code="export function getDiscount(orderTotal) { if (orderTotal > 100) return 0.15; return 0.05; }",
        framework="vitest",
    )
    assert "vitest" in test_code or "describe" in test_code
    assert "expect" in test_code
    assert "ROR" in test_code or "line 12" in test_code


# =============================================================================
# 4. Dual-State Test Validator (Ephemeral Node Sandbox Execution)
# =============================================================================

@pytest.mark.asyncio
async def test_dual_state_validation_jsts_success():
    source_code = """
export function calculateTierDiscount(orderTotal, customerTier) {
    if (orderTotal <= 0) {
        throw new Error("Order total must be positive");
    }
    if (customerTier === "PLATINUM") {
        if (orderTotal > 100) {
            return 0.15;
        }
        return 0.05;
    }
    return 0.0;
}
"""
    mutated_source = """
export function calculateTierDiscount(orderTotal, customerTier) {
    if (orderTotal <= 0) {
        throw new Error("Order total must be positive");
    }
    if (customerTier === "PLATINUM") {
        if (orderTotal >= 100) {
            return 0.15;
        }
        return 0.05;
    }
    return 0.0;
}
"""
    killing_candidate_test = """
import { describe, it, expect } from 'vitest';
import { calculateTierDiscount } from './solution';

describe('calculateTierDiscount boundary test', () => {
    it('kills ROR mutation when orderTotal is exactly 100', () => {
        expect(calculateTierDiscount(100, 'PLATINUM')).toBe(0.05);
    });
});
"""
    result = await DualStateTestValidator.validate_candidate_test(
        source_code=source_code,
        mutated_source=mutated_source,
        candidate_test_code=killing_candidate_test,
        language="javascript",
    )

    assert result.verified is True
    assert result.baseline_passed is True
    assert result.mutant_killed is True
    assert result.verification_status == "mutation_killing"
    assert len(result.evidence_hash) == 64


@pytest.mark.asyncio
async def test_dual_state_validation_jsts_fails_on_broken_test():
    source_code = "export function add(a, b) { return a + b; }\n"
    mutated_source = "export function add(a, b) { return a - b; }\n"
    broken_candidate_test = """
import { describe, it, expect } from 'vitest';
import { add } from './solution';

describe('broken test', () => {
    it('fails on baseline code', () => {
        expect(add(2, 3)).toBe(999);
    });
});
"""
    result = await DualStateTestValidator.validate_candidate_test(
        source_code=source_code,
        mutated_source=mutated_source,
        candidate_test_code=broken_candidate_test,
        language="javascript",
    )

    assert result.verified is False
    assert result.baseline_passed is False
    assert result.verification_status == "execution_failure"


# =============================================================================
# 5. CodeLab Service Polyglot Execution
# =============================================================================

def test_codelab_service_typescript():
    ts_source = """
export function computeDiscount(total: number, isVip: boolean): number {
    if (total > 50 && isVip) {
        return 20;
    }
    return 0;
}
"""
    # 1. Analyze
    analysis = CodeLabService.analyze(ts_source, language="typescript")
    assert analysis.language == "typescript"
    assert len(analysis.mutation_candidates) > 0

    # 2. Synthesize
    synth = CodeLabService.synthesize(ts_source, language="typescript")
    assert "vitest" in synth.synthesized_test_code or "describe" in synth.synthesized_test_code
    assert "expect" in synth.synthesized_test_code

    # 3. Execute Sandbox
    test_code = """
import { describe, it, expect } from 'vitest';
import { computeDiscount } from './solution';

describe('computeDiscount tests', () => {
    it('calculates VIP discount', () => {
        expect(computeDiscount(60, true)).toBe(20);
        expect(computeDiscount(40, true)).toBe(0);
    });
});
"""
    exec_result = CodeLabService.execute_sandbox(ts_source, test_code, language="typescript")
    assert exec_result.baseline_passed is True
    assert exec_result.is_executable is True
    assert exec_result.exit_code == 0


# =============================================================================
# 6. Discovery Service Polyglot Workspace Scanning
# =============================================================================

def test_discovery_service_polyglot():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        # Create a sample JS/TS project layout
        (root / "src").mkdir()
        (root / "src" / "App.tsx").write_text("export const App = () => <div>Hello</div>;")
        (root / "src" / "utils.ts").write_text("export const add = (a: number, b: number) => a + b;")
        (root / "tests").mkdir()
        (root / "tests" / "utils.test.ts").write_text("test('add', () => {});")
        (root / "package.json").write_text('{"dependencies": {"react": "^18.0.0"}}')

        res = TestDiscoveryService.discover_source_and_test_files(str(root), language="auto")
        assert res["language"] == "typescript"
        assert len(res["source_files"]) >= 2
        assert len(res["test_files"]) >= 1
        assert any("App.tsx" in f for f in res["source_files"])
        assert any("utils.ts" in f for f in res["source_files"])
        assert any("utils.test.ts" in f for f in res["test_files"])


def test_discovery_service_polyglot_prioritizes_typescript_over_utility_python_script():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        (root / "src").mkdir()
        (root / "src" / "App.tsx").write_text("export const App = () => <div>Hello</div>;")
        (root / "src" / "utils.ts").write_text("export const add = (a: number, b: number) => a + b;")
        (root / "src" / "Header.tsx").write_text("export const Header = () => <header></header>;")
        (root / "scripts").mkdir()
        (root / "scripts" / "build.py").write_text("print('build script')")
        (root / "package.json").write_text('{"name": "frontend-app", "dependencies": {"react": "^18.0.0"}}')

        # Even with scripts/build.py present, language="auto" must detect typescript
        res = TestDiscoveryService.discover_source_and_test_files(str(root), language="auto")
        assert res["language"] == "typescript"
        assert "src/App.tsx" in res["source_files"]
        assert "src/utils.ts" in res["source_files"]


def test_codelab_jsts_to_throw_matcher():
    source = """
export function requirePositive(n: number): number {
    if (n <= 0) {
        throw new Error("Value must be positive");
    }
    return n;
}
"""
    test_code = """
import { describe, it, expect } from 'vitest';
import { requirePositive } from './solution';

describe('requirePositive tests', () => {
    it('throws with exact message on negative input', () => {
        expect(() => requirePositive(-5)).toThrow("Value must be positive");
    });
    it('returns positive input directly', () => {
        expect(requirePositive(10)).toBe(10);
    });
});
"""
    res = CodeLabService.execute_sandbox(source, test_code, language="typescript")
    assert res.exit_code == 0
    assert res.baseline_passed is True
    assert res.is_executable is True

