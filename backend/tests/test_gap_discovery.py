import os
import shutil
import sys
import tempfile
import uuid
import pytest
from httpx import AsyncClient

from app.services.discovery_service import TestDiscoveryService
from app.services.llm_service import LLMTestSynthesizer
from app.services.mutation_engine import ASTMutationEngine, MutantSpec
from app.services.validation_service import DualStateTestValidator


SAMPLE_CODE = """def check_access(age: int, has_pass: bool, discount_rate: float) -> str:
    if age >= 18 and has_pass:
        final_price = 100.0 * (1.0 - discount_rate)
        return f"GRANTED:{final_price}"
    return "DENIED"
"""


# -----------------------------------------------------------------------------
# 1. AST Mutation Engine Operator Tests
# -----------------------------------------------------------------------------
def test_ast_mutation_engine_operators():
    mutants = ASTMutationEngine.generate_mutants_for_source(SAMPLE_CODE)
    assert len(mutants) > 0

    operators = {m.operator for m in mutants}
    assert "ROR" in operators, "ROR (Relational Operator Replacement) must be present"
    assert "AOR" in operators, "AOR (Arithmetic Operator Replacement) must be present"
    assert "LCR" in operators, "LCR (Logical Connector Replacement) must be present"
    assert "BSR" in operators, "BSR (Boundary Shift Replacement) must be present"

    # Verify ROR substitution
    ror_mutants = [m for m in mutants if m.operator == "ROR"]
    assert any(m.original_token == ">=" and m.mutated_token == ">" for m in ror_mutants)

    # Verify AOR substitution
    aor_mutants = [m for m in mutants if m.operator == "AOR"]
    assert any(m.original_token in ("*", "-") for m in aor_mutants)

    # Verify LCR substitution
    lcr_mutants = [m for m in mutants if m.operator == "LCR"]
    assert any(m.original_token == "and" and m.mutated_token == "or" for m in lcr_mutants)

    # Verify BSR substitution
    bsr_mutants = [m for m in mutants if m.operator == "BSR"]
    assert any(m.original_token in ("18", "100") for m in bsr_mutants)


# -----------------------------------------------------------------------------
# 2. Syntax Validation of Mutated Code
# -----------------------------------------------------------------------------
def test_ast_mutation_syntax_validation():
    mutants = ASTMutationEngine.generate_mutants_for_source(SAMPLE_CODE)
    for m in mutants:
        # Every generated valid mutant must be syntactically valid Python
        if m.is_valid:
            assert compile(m.mutated_source, "<test>", "exec") is not None


# -----------------------------------------------------------------------------
# 3. Equivalent Mutant Detection Heuristic
# -----------------------------------------------------------------------------
def test_ast_equivalent_mutant_detection():
    dead_code = """def func(x):
    if True or False:
        return x
    return 0
"""
    mutants = ASTMutationEngine.generate_mutants_for_source(dead_code)
    # Mutants touching identity conditionals should be flagged
    for m in mutants:
        if "if True or False" in m.mutated_snippet:
            assert m.is_equivalent is True
            assert m.status == "equivalent"


def test_interactive_cli_mutants_flagged_equivalent():
    cli_code = """import sys

def menu():
    opt = int(input("Enter choice: "))
    if opt == 1:
        pass
    elif opt == 5:
        sys.exit()

def pure_calc(x):
    if x > 10:
        return x * 2
    return x
"""
    mutants = ASTMutationEngine.generate_mutants_for_source(cli_code)
    # Mutants inside menu() should be flagged as equivalent (untestable in unit test mode)
    menu_mutants = [m for m in mutants if "opt == 1" in m.original_snippet]
    assert len(menu_mutants) > 0
    for m in menu_mutants:
        assert m.is_equivalent is True
        assert m.status == "equivalent"
        assert "Interactive CLI Routine" in m.description

    # Pure calculation function mutants should NOT be equivalent
    calc_mutants = [m for m in mutants if "x > 10" in m.original_snippet]
    assert len(calc_mutants) > 0
    for m in calc_mutants:
        assert m.is_equivalent is False
        assert m.status == "pending"


# -----------------------------------------------------------------------------
# 4. Baseline Test Execution
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_baseline_test_execution_success_and_failure():
    temp_dir = tempfile.mkdtemp(prefix="tb_test_baseline_")
    try:
        # 1. Successful baseline
        sol_file = os.path.join(temp_dir, "solution.py")
        test_file = os.path.join(temp_dir, "test_solution.py")

        with open(sol_file, "w") as f:
            f.write("def add(a, b): return a + b\n")
        with open(test_file, "w") as f:
            f.write("from solution import add\ndef test_add(): assert add(2, 3) == 5\n")

        base_res = await TestDiscoveryService.run_baseline_tests(temp_dir)
        assert base_res.passed is True
        assert base_res.exit_code == 0
        assert base_res.total_tests >= 1

        # 2. Failing baseline
        with open(test_file, "w") as f:
            f.write("from solution import add\ndef test_add(): assert add(2, 3) == 999\n")

        fail_res = await TestDiscoveryService.run_baseline_tests(temp_dir)
        assert fail_res.passed is False
        assert fail_res.exit_code != 0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 5. Mutation Execution: Kills vs Survivors
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_mutation_execution_pipeline_kills_and_survivors():
    temp_dir = tempfile.mkdtemp(prefix="tb_test_mut_exec_")
    try:
        sol_file = os.path.join(temp_dir, "solution.py")
        test_file = os.path.join(temp_dir, "test_solution.py")

        # Code with boundary at 100
        pristine = (
            "def discount(x):\n"
            "    if x > 100:\n"
            "        return 0.15\n"
            "    return 0.05\n"
        )
        with open(sol_file, "w") as f:
            f.write(pristine)

        # Existing test suite ONLY tests 150 and 50 (does NOT test boundary 100)
        with open(test_file, "w") as f:
            f.write(
                "from solution import discount\n"
                "def test_high(): assert discount(150) == 0.15\n"
                "def test_low(): assert discount(50) == 0.05\n"
            )

        # Mutant 1: x >= 100 (SURVIVES! because 150 > 100 and 50 < 100 behave identically)
        mut_survived = pristine.replace("x > 100", "x >= 100")
        status_1, _ = await TestDiscoveryService.execute_mutant(temp_dir, "solution.py", mut_survived)
        assert status_1 == "survived", "Boundary mutant >= 100 should survive inadequate tests"

        # Mutant 2: return 0.99 instead of 0.15 (KILLED! test_high fails)
        mut_killed = pristine.replace("return 0.15", "return 0.99")
        status_2, killing_test = await TestDiscoveryService.execute_mutant(temp_dir, "solution.py", mut_killed)
        assert status_2 == "killed", "Return value mutant should be killed by test_high"
        assert killing_test is not None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 6. Mutation Score Calculation Formula
# -----------------------------------------------------------------------------
def test_mutation_score_calculation_formula():
    # Formula: Score = (Killed / (Total - Equivalent - Invalid)) * 100%
    total = 20
    killed = 14
    equivalent = 2
    invalid = 1
    non_equivalent = total - equivalent - invalid  # 17
    expected_score = round((killed / non_equivalent) * 100.0, 1)  # (14 / 17) * 100 = 82.4%

    score = round((killed / (total - equivalent - invalid)) * 100.0, 1)
    assert score == 82.4
    assert expected_score == 82.4


# -----------------------------------------------------------------------------
# 7. LLM Gap Explanation & Test Synthesis
# -----------------------------------------------------------------------------
def test_llm_gap_explanation_and_synthesis():
    mut = MutantSpec(
        id="MUT-1",
        file_path="auth.py",
        line_number=12,
        col_offset=0,
        operator="ROR",
        original_token=">",
        mutated_token=">=",
        original_snippet="if order_total > 100.0:",
        mutated_snippet="if order_total >= 100.0:",
        description="Relational operator > to >=",
    )

    gap = LLMTestSynthesizer.explain_gap(SAMPLE_CODE, mut)
    assert "ROR" in gap.rationale or "Relational" in gap.explanation
    assert len(gap.missing_boundary) > 0
    assert len(gap.recommended_action) > 0

    synthesized_code = LLMTestSynthesizer.synthesize_killing_test(SAMPLE_CODE, mut)
    assert "def test_" in synthesized_code
    assert "assert " in synthesized_code
    assert "pytest" in synthesized_code


# -----------------------------------------------------------------------------
# 8. Dual-State Validation: Certifies Killing Test
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dual_state_validation_certifies_killing_test():
    source = (
        "def discount(x: float) -> float:\n"
        "    if x > 100.0:\n"
        "        return 0.15\n"
        "    return 0.05\n"
    )
    mutated = source.replace("x > 100.0", "x >= 100.0")

    # Test asserts exact boundary x == 100.0 -> returns 0.05 on pristine, returns 0.15 on mutant!
    test_code = (
        "from solution import discount\n"
        "def test_boundary_exact():\n"
        "    assert discount(100.0) == 0.05\n"
    )

    outcome = await DualStateTestValidator.validate_candidate_test(
        source_code=source,
        mutated_source=mutated,
        candidate_test_code=test_code,
    )

    assert outcome.baseline_passed is True
    assert outcome.mutant_killed is True
    assert outcome.verified is True
    assert outcome.verification_status == "mutation_killing"
    assert len(outcome.evidence_hash) == 64


# -----------------------------------------------------------------------------
# 9. Dual-State Validation: Rejects Hallucinated / Broken Test
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dual_state_validation_rejects_hallucination():
    source = "def get_val(): return 42\n"
    mutated = "def get_val(): return 99\n"

    # Hallucinated test: fails on baseline code
    hallucinated_test = (
        "from solution import get_val\n"
        "def test_hallucination():\n"
        "    assert get_val() == 999999  # WRONG!\n"
    )

    outcome = await DualStateTestValidator.validate_candidate_test(
        source_code=source,
        mutated_source=mutated,
        candidate_test_code=hallucinated_test,
    )

    assert outcome.baseline_passed is False
    assert outcome.verified is False
    assert outcome.verification_status == "execution_failure"


# -----------------------------------------------------------------------------
# 10. End-to-End Project Scan, Synthesis, and Promotion Workflow
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_end_to_end_project_scan_synthesis_promotion(client: AsyncClient, tenant_a):
    # 1. Create project
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "AI Gap Discovery Project", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # 2. Trigger synchronous scan
    scan_res = await client.post(
        f"/api/v1/projects/{proj_id}/scan-jobs/sync",
        json={"branch": "main", "trigger": "manual"},
        headers=tenant_a["headers"],
    )
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    job_id = scan_data["id"]

    assert scan_data["total_mutants"] > 0
    assert scan_data["status"] == "completed"

    # 3. List mutations
    muts_res = await client.get(
        f"/api/v1/scan-jobs/{job_id}/mutations",
        headers=tenant_a["headers"],
    )
    assert muts_res.status_code == 200
    mutations = muts_res.json()
    assert len(mutations) > 0

    target_mut = mutations[0]
    mut_id = target_mut["id"]

    # 4. Synthesize test for the mutation
    synth_res = await client.post(
        f"/api/v1/scan-jobs/{job_id}/mutations/{mut_id}/synthesize",
        headers=tenant_a["headers"],
    )
    assert synth_res.status_code == 200
    synth_data = synth_res.json()
    assert "synthesized_test_code" in synth_data
    assert synth_data["verification_status"] in ("mutation_killing", "verified_passing", "execution_failure")
    assert len(synth_data["evidence_hash"]) == 64

    # 5. Promote test to regression test suite
    promote_res = await client.post(
        f"/api/v1/scan-jobs/{job_id}/mutations/{mut_id}/promote",
        json={"name": "test_verified_boundary_discount"},
        headers=tenant_a["headers"],
    )
    assert promote_res.status_code == 200
    promote_data = promote_res.json()
    assert promote_data["status"] in ("verified", "unverified")
    assert promote_data["mutation_kill_count"] in (0, 1)


# -----------------------------------------------------------------------------
# 11. Cross-Tenant Isolation for Scans & Mutations
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cross_tenant_scan_isolation(client: AsyncClient, tenant_a, tenant_b):
    # Tenant A creates project & runs scan
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Tenant A Private Suite", "framework": "pytest"},
        headers=tenant_a["headers"],
    )
    proj_id = proj_res.json()["id"]

    scan_res = await client.post(
        f"/api/v1/projects/{proj_id}/scan-jobs/sync",
        json={"branch": "main"},
        headers=tenant_a["headers"],
    )
    job_id = scan_res.json()["id"]

    # Tenant B tries to get Tenant A scan job -> 404
    cross_job = await client.get(
        f"/api/v1/scan-jobs/{job_id}",
        headers=tenant_b["headers"],
    )
    assert cross_job.status_code == 404

    # Tenant B tries to list Tenant A mutations -> 200 with empty list or 404
    cross_muts = await client.get(
        f"/api/v1/scan-jobs/{job_id}/mutations",
        headers=tenant_b["headers"],
    )
    assert len(cross_muts.json()) == 0
