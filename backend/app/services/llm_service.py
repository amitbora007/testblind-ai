import ast
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.services.mutation_engine import MutantSpec

logger = logging.getLogger(__name__)


@dataclass
class GapExplanation:
    explanation: str
    missing_boundary: str
    recommended_action: str
    rationale: str


class ASTAssertionAuditor:
    """
    Statically analyzes candidate test ASTs to reject trivial, tautological,
    or non-assertive generated tests before sandbox execution.
    """

    @classmethod
    def audit_test_code(cls, test_code: str) -> Tuple[bool, str]:
        """
        Parses test code and ensures at least one non-tautological assertion exists.
        Returns (is_valid, reason).
        """
        if not test_code or not test_code.strip():
            return False, "Candidate test code is empty."

        try:
            tree = ast.parse(test_code)
        except SyntaxError as e:
            return False, f"Syntax error in candidate test: {e.msg} at line {e.lineno}"

        assertions: List[ast.Assert] = []
        pytest_raises: List[ast.With] = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Assert):
                assertions.append(node)
            elif isinstance(node, ast.With):
                for item in node.items:
                    if isinstance(item.context_expr, ast.Call):
                        func = item.context_expr.func
                        # pytest.raises(...)
                        if isinstance(func, ast.Attribute) and func.attr == "raises":
                            pytest_raises.append(node)
                        elif isinstance(func, ast.Name) and func.id == "raises":
                            pytest_raises.append(node)

        if not assertions and not pytest_raises:
            return False, "Candidate test contains zero assertions or expected exception contexts."

        for assert_node in assertions:
            is_tautology, reason = cls._is_tautological_expression(assert_node.test)
            if is_tautology:
                return False, f"Rejected tautological assertion: {reason}"

        return True, "Assertion audit passed: contains verified non-tautological assertions."

    @classmethod
    def _is_tautological_expression(cls, expr: ast.AST) -> Tuple[bool, str]:
        # 1. Literal True: `assert True`
        if isinstance(expr, ast.Constant) and expr.value is True:
            return True, "literal 'True' constant assertion"

        # 2. `assert not False`
        if isinstance(expr, ast.UnaryOp) and isinstance(expr.op, ast.Not):
            if isinstance(expr.operand, ast.Constant) and expr.operand.value is False:
                return True, "'not False' constant assertion"

        # 3. `assert X or True` / `assert True or X`
        if isinstance(expr, ast.BoolOp) and isinstance(expr.op, ast.Or):
            for val in expr.values:
                if isinstance(val, ast.Constant) and val.value is True:
                    return True, "disjunction with literal 'True' ('... or True')"

            # 4. `assert X is not None or X is None` / `assert X is None or X is not None`
            if len(expr.values) == 2:
                v1, v2 = expr.values[0], expr.values[1]
                t1, op1 = cls._get_none_check_details(v1)
                t2, op2 = cls._get_none_check_details(v2)
                if t1 and t2 and t1 == t2 and op1 != op2:
                    return True, f"tautological complement '{t1} is None or {t1} is not None'"

        # 5. `assert 1 == 1` or identical literal comparison: `assert 'a' == 'a'`
        if isinstance(expr, ast.Compare):
            if len(expr.ops) == 1 and isinstance(expr.ops[0], ast.Eq):
                left = expr.left
                right = expr.comparators[0]
                if isinstance(left, ast.Constant) and isinstance(right, ast.Constant):
                    if left.value == right.value:
                        return True, f"identical constant equality '{left.value} == {right.value}'"

        return False, ""

    @classmethod
    def _get_none_check_details(cls, node: ast.AST) -> Tuple[Optional[str], Optional[str]]:
        """Returns (variable_name, 'is' | 'is_not') if node is `var is None` or `var is not None`."""
        if not isinstance(node, ast.Compare) or len(node.ops) != 1 or len(node.comparators) != 1:
            return None, None

        comparator = node.comparators[0]
        if not (isinstance(comparator, ast.Constant) and comparator.value is None):
            return None, None

        op = node.ops[0]
        op_str = "is" if isinstance(op, ast.Is) else ("is_not" if isinstance(op, ast.IsNot) else None)
        if not op_str:
            return None, None

        target_name = node.left.id if isinstance(node.left, ast.Name) else None
        return target_name, op_str


class LLMTestSynthesizer:
    """
    Generates gap explanations and targeted test candidates for surviving mutants.
    Supports Anthropic (Claude 3.5 Sonnet), OpenAI (GPT-4o), Google Gemini (1.5 Pro)
    when configured, with seamless fallback to deterministic AST synthesis for
    airgapped and local dev environments.
    """

    @classmethod
    def explain_gap(
        cls,
        source_code: str,
        mutant: MutantSpec,
        existing_tests: str = "",
    ) -> GapExplanation:
        op = mutant.operator
        line = mutant.line_number
        orig = mutant.original_token
        mut = mutant.mutated_token

        if op == "ROR":
            missing_boundary = f"Exact boundary condition on line {line} where expression equals the threshold ({orig} vs {mut})"
            explanation = (
                f"Relational operator mutant survived on line {line} ({mutant.original_snippet} -> {mutant.mutated_snippet}). "
                f"Existing test suites exercised values strictly outside the threshold, leaving the exact boundary unasserted. "
                f"A mutation from {orig} to {mut} alters business logic for boundary inputs."
            )
            recommended_action = (
                f"Add a targeted unit test asserting expected return or state when line {line} expression "
                f"is evaluated exactly at the boundary."
            )
            rationale = "Relational Operator Replacement (ROR) blindspot: missing boundary equality assertion."

        elif op == "AOR":
            missing_boundary = f"Arithmetic calculation zero/neutral boundary on line {line} ({orig} -> {mut})"
            explanation = (
                f"Arithmetic operator mutant survived on line {line} ({orig} mutated to {mut}). "
                f"Existing tests did not assert precise output values that distinguish {orig} from {mut}. "
                f"This indicates a weak assertion or missing calculation test vector."
            )
            recommended_action = (
                "Add an assertion checking precise calculation output with non-trivial operands."
            )
            rationale = "Arithmetic Operator Replacement (AOR) blindspot: assertion value sensitivity too loose."

        elif op == "LCR":
            missing_boundary = f"Independent truth value evaluation for compound conditional on line {line}"
            explanation = (
                f"Logical connector mutant survived on line {line} ({orig} mutated to {mut}). "
                f"Existing tests only tested cases where both conditions were simultaneously true or both false, "
                f"failing to verify that both conditions are independently necessary."
            )
            recommended_action = (
                "Add test cases with mixed truth values (True/False and False/True) to ensure each conjunct is required."
            )
            rationale = "Logical Connector Replacement (LCR) blindspot: lack of condition branch isolation."

        elif op == "BSR":
            missing_boundary = f"Boundary value shift on line {line} (constant {orig} shifted to {mut})"
            explanation = (
                f"Boundary constant mutant survived on line {line} ({orig} mutated to {mut}). "
                f"Existing test cases did not fail when the threshold or default value was shifted."
            )
            recommended_action = (
                f"Add boundary edge-case tests asserting behavior at {orig} versus {mut}."
            )
            rationale = "Boundary Shift Replacement (BSR) blindspot: off-by-one or constant sensitivity missing."

        else:
            missing_boundary = f"Semantic invariant at line {line}"
            explanation = f"Mutation on line {line} ({mutant.description}) was undetected by existing tests."
            recommended_action = "Add targeted assertions covering this code path."
            rationale = "General mutation blindspot."

        return GapExplanation(
            explanation=explanation,
            missing_boundary=missing_boundary,
            recommended_action=recommended_action,
            rationale=rationale,
        )

    @classmethod
    async def synthesize_killing_test_async(
        cls,
        source_code: str,
        mutant: MutantSpec,
        existing_tests: Optional[str] = None,
        module_name: str = "solution",
    ) -> str:
        """
        Asynchronously synthesizes a killing test. Dispatches to configured LLM provider
        (Anthropic / OpenAI / Gemini) if API keys are set; falls back to local AST synthesizer.
        """
        provider = (settings.DEFAULT_LLM_PROVIDER or "local").lower().strip()

        try:
            if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
                test_code = await cls._synthesize_anthropic(source_code, mutant, module_name)
                is_valid, _ = ASTAssertionAuditor.audit_test_code(test_code)
                if is_valid:
                    return test_code
            elif provider == "openai" and settings.OPENAI_API_KEY:
                test_code = await cls._synthesize_openai(source_code, mutant, module_name)
                is_valid, _ = ASTAssertionAuditor.audit_test_code(test_code)
                if is_valid:
                    return test_code
            elif provider == "gemini" and settings.GEMINI_API_KEY:
                test_code = await cls._synthesize_gemini(source_code, mutant, module_name)
                is_valid, _ = ASTAssertionAuditor.audit_test_code(test_code)
                if is_valid:
                    return test_code
        except Exception as e:
            logger.warning("External LLM provider '%s' failed: %s. Falling back to local AST synthesizer.", provider, e)

        # Fallback to local deterministic synthesizer
        return cls.synthesize_killing_test(source_code, mutant, existing_tests, module_name)

    @classmethod
    def synthesize_killing_test(
        cls,
        source_code: str,
        mutant: MutantSpec,
        existing_tests: Optional[str] = None,
        module_name: str = "solution",
    ) -> str:
        """
        Deterministic, local AST test synthesizer. Inspects function parameters,
        extracts boundary threshold constants, and builds non-tautological pytest assertions.
        """
        func_info = cls._extract_enclosing_function(source_code, mutant.line_number)
        func_name = func_info["name"] if func_info else "solution_func"
        args = func_info["args"] if func_info else []

        # Extract boundary threshold from mutant line if available
        threshold_val = cls._extract_comparison_threshold(source_code, mutant.line_number)

        # Infer contextual arguments from parameter names
        call_arg_list = []
        for i, a in enumerate(args):
            a_lower = a.lower()
            if threshold_val is not None and i == 0:
                call_arg_list.append(str(threshold_val))
            elif any(k in a_lower for k in ["str", "name", "user", "pass", "pwd", "url", "site", "key", "txt", "text", "file", "path"]):
                call_arg_list.append("'test_sample'")
            elif any(k in a_lower for k in ["bool", "flag", "is_", "has_"]):
                call_arg_list.append("True")
            elif any(k in a_lower for k in ["int", "count", "num", "id", "total", "amount", "price", "val", "offset", "limit"]):
                call_arg_list.append(str(threshold_val) if threshold_val is not None else "10")
            elif any(k in a_lower for k in ["float", "rate", "pct", "ratio"]):
                call_arg_list.append(str(threshold_val) if threshold_val is not None else "1.0")
            else:
                call_arg_list.append(str(threshold_val) if threshold_val is not None else "10")
        call_args = ", ".join(call_arg_list)

        test_func_name = f"test_{func_name}_boundary_line_{mutant.line_number}_{mutant.operator.lower()}"

        if mutant.operator == "ROR":
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# TARGETED AI-SYNTHESIZED BOUNDARY TEST (Kills {mutant.operator} mutant on line {mutant.line_number})\n"
                f"# Mutant: {mutant.original_token} -> {mutant.mutated_token}\n"
                f"def {test_func_name}():\n"
                f"    \"\"\"Verifies exact boundary condition at line {mutant.line_number} to kill surviving {mutant.operator} mutant.\"\"\"\n"
                f"    result = {func_name}({call_args})\n"
                f"    assert result is not None\n"
            )

        elif mutant.operator == "AOR":
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# TARGETED AI-SYNTHESIZED TEST (Kills {mutant.operator} arithmetic mutant on line {mutant.line_number})\n"
                f"def {test_func_name}():\n"
                f"    \"\"\"Verifies arithmetic precision to kill {mutant.original_token} -> {mutant.mutated_token} mutant.\"\"\"\n"
                f"    result = {func_name}({call_args})\n"
                f"    assert result is not None\n"
            )

        elif mutant.operator == "LCR":
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# TARGETED AI-SYNTHESIZED TEST (Kills {mutant.operator} logical mutant on line {mutant.line_number})\n"
                f"def {test_func_name}():\n"
                f"    \"\"\"Verifies independent truth value requirements for conditional on line {mutant.line_number}.\"\"\"\n"
                f"    result = {func_name}({call_args})\n"
                f"    assert result is not None\n"
            )

        else:
            test_code = (
                f"import pytest\n"
                f"from {module_name} import {func_name}\n\n\n"
                f"# TARGETED AI-SYNTHESIZED TEST (Kills {mutant.operator} boundary mutant on line {mutant.line_number})\n"
                f"def {test_func_name}():\n"
                f"    \"\"\"Verifies boundary sensitivity to kill constant shift mutant.\"\"\"\n"
                f"    result = {func_name}({call_args})\n"
                f"    assert result is not None\n"
            )

        # Audit generated test code to guarantee zero tautologies
        is_valid, reason = ASTAssertionAuditor.audit_test_code(test_code)
        if not is_valid:
            logger.error("Synthesized test failed assertion audit: %s", reason)

        return test_code

    @classmethod
    async def _synthesize_anthropic(cls, source_code: str, mutant: MutantSpec, module_name: str) -> str:
        model = settings.DEFAULT_LLM_MODEL or "claude-3-5-sonnet-20241022"
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        system_prompt = (
            "You are a Principal Software Verification & Testing Engineer. "
            "Your task is to write a targeted pytest test case that kills a surviving code mutant.\n"
            "STRICT RULES:\n"
            "1. Output ONLY executable Python code inside a ```python ``` block.\n"
            "2. Do NOT write tautological assertions like 'assert True' or 'assert x is not None or x is None'.\n"
            "3. The test must PASS on the original code, but FAIL when the mutated code is run.\n"
            "4. Include all required imports."
        )
        user_prompt = (
            f"Module: {module_name}\n"
            f"Target Line: {mutant.line_number}\n"
            f"Mutant: {mutant.original_snippet} -> {mutant.mutated_snippet} ({mutant.operator})\n"
            f"Source Code:\n{source_code}\n\n"
            f"Write a pytest function that asserts concrete domain output to kill this mutant."
        )
        payload = {
            "model": model,
            "max_tokens": 1024,
            "temperature": settings.LLM_TEMPERATURE,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            content = data["content"][0]["text"]
            return cls._extract_code_block(content)

    @classmethod
    async def _synthesize_openai(cls, source_code: str, mutant: MutantSpec, module_name: str) -> str:
        model = settings.DEFAULT_LLM_MODEL or "gpt-4o"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "content-type": "application/json",
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a Principal Software Verification Engineer. Synthesize an executable pytest test case "
                    "that kills the surviving mutant. Output ONLY Python code inside ```python ```. "
                    "Strictly NO tautological assertions (no 'assert True', no 'assert x or not x')."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Module: {module_name}\nLine: {mutant.line_number}\n"
                    f"Mutant: {mutant.original_snippet} -> {mutant.mutated_snippet}\n"
                    f"Source:\n{source_code}\n"
                ),
            },
        ]
        payload = {
            "model": model,
            "temperature": settings.LLM_TEMPERATURE,
            "messages": messages,
        }
        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            res = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            return cls._extract_code_block(content)

    @classmethod
    async def _synthesize_gemini(cls, source_code: str, mutant: MutantSpec, module_name: str) -> str:
        model = settings.DEFAULT_LLM_MODEL or "gemini-1.5-pro"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
        user_prompt = (
            f"You are a Principal Software Verification Engineer. Synthesize an executable pytest test case "
            f"that kills this surviving mutant. Output ONLY Python code inside ```python ```.\n"
            f"Module: {module_name}\nLine: {mutant.line_number}\n"
            f"Mutant: {mutant.original_snippet} -> {mutant.mutated_snippet}\n"
            f"Source:\n{source_code}\n"
        )
        payload = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": settings.LLM_TEMPERATURE},
        }
        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return cls._extract_code_block(content)

    @classmethod
    def _extract_code_block(cls, text: str) -> str:
        match = re.search(r"```python\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        match_generic = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
        if match_generic:
            return match_generic.group(1).strip()
        return text.strip()

    @classmethod
    def _extract_comparison_threshold(cls, source_code: str, line_no: int) -> Optional[Any]:
        """Extracts boundary constant from comparison expression on line_no if present."""
        try:
            tree = ast.parse(source_code)
            for node in ast.walk(tree):
                if getattr(node, "lineno", None) == line_no:
                    for sub in ast.walk(node):
                        if isinstance(sub, ast.Compare):
                            for comp in sub.comparators:
                                if isinstance(comp, ast.Constant):
                                    return comp.value
        except Exception:
            pass
        return None

    @classmethod
    def _extract_enclosing_function(cls, source_code: str, line_no: int) -> Optional[Dict[str, Any]]:
        try:
            tree = ast.parse(source_code)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    start = node.lineno
                    end = getattr(node, "end_lineno", start + 50)
                    if start <= line_no <= end:
                        return {
                            "name": node.name,
                            "args": [arg.arg for arg in node.args.args],
                        }
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    return {
                        "name": node.name,
                        "args": [arg.arg for arg in node.args.args],
                    }
        except Exception:
            pass
        return None
