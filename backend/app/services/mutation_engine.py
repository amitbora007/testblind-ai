import ast
import copy
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MutantSpec:
    id: str
    file_path: str
    line_number: int
    col_offset: int
    operator: str  # ROR, AOR, LCR, BSR
    original_token: str
    mutated_token: str
    original_snippet: str
    mutated_snippet: str
    description: str
    mutated_source: str = ""
    is_valid: bool = True
    is_equivalent: bool = False
    status: str = "pending"  # pending, killed, survived, timeout, invalid, equivalent
    killing_test_name: Optional[str] = None
    synthesized_test_code: Optional[str] = None
    verification_status: Optional[str] = None  # ai_suggestion, generated_unexecuted, verified_passing, mutation_killing, execution_failure
    evidence_hash: Optional[str] = None
    explanation: Optional[str] = None
    missing_boundary: Optional[str] = None


class ASTMutationEngine:
    """
    Analyzes Python AST and generates systematic semantic mutations across
    ROR, AOR, LCR, and BSR operator catalogs with syntax compilation validation
    and equivalent mutant heuristics.
    """

    # Relational Operator Map (ROR)
    ROR_MAP = {
        ast.Gt: [(ast.GtE, ">", ">=", "Relational: strictly greater than (>) to greater or equal (>=)")],
        ast.Lt: [(ast.LtE, "<", "<=", "Relational: strictly less than (<) to less or equal (<=)")],
        ast.GtE: [(ast.Gt, ">=", ">", "Relational: greater or equal (>=) to strictly greater than (>)")],
        ast.LtE: [(ast.Lt, "<=", "<", "Relational: less or equal (<=) to strictly less than (<)")],
        ast.Eq: [(ast.NotEq, "==", "!=", "Relational: equality (==) to inequality (!=)")],
        ast.NotEq: [(ast.Eq, "!=", "==", "Relational: inequality (!=) to equality (==)")],
        ast.In: [(ast.NotIn, "in", "not in", "Relational: inclusion (in) to exclusion (not in)")],
        ast.NotIn: [(ast.In, "not in", "in", "Relational: exclusion (not in) to inclusion (in)")],
        ast.Is: [(ast.IsNot, "is", "is not", "Relational: identity (is) to non-identity (is not)")],
        ast.IsNot: [(ast.Is, "is not", "is", "Relational: non-identity (is not) to identity (is)")],
    }

    # Arithmetic Operator Map (AOR)
    AOR_MAP = {
        ast.Add: [(ast.Sub, "+", "-", "Arithmetic: addition (+) to subtraction (-)")],
        ast.Sub: [(ast.Add, "-", "+", "Arithmetic: subtraction (-) to addition (+)")],
        ast.Mult: [(ast.Div, "*", "/", "Arithmetic: multiplication (*) to division (/)")],
        ast.Div: [(ast.Mult, "/", "*", "Arithmetic: division (/) to multiplication (*)")],
        ast.FloorDiv: [(ast.Div, "//", "/", "Arithmetic: floor division (//) to true division (/)")],
        ast.Mod: [(ast.Mult, "%", "*", "Arithmetic: modulo (%) to multiplication (*)")],
        ast.Pow: [(ast.Mult, "**", "*", "Arithmetic: exponentiation (**) to multiplication (*)")],
    }

    # Logical Connector Map (LCR)
    LCR_MAP = {
        ast.And: [(ast.Or, "and", "or", "Logical: connector conjunction (and) to disjunction (or)")],
        ast.Or: [(ast.And, "or", "and", "Logical: connector disjunction (or) to conjunction (and)")],
    }

    @classmethod
    def generate_mutants_for_source(
        cls,
        source_code: str,
        file_path: str = "solution.py",
        max_mutants: int = 50,
        language: str = "auto",
    ) -> List[MutantSpec]:
        """
        Parses source code into AST/syntax nodes and synthesizes candidate mutants
        across ROR, AOR, LCR, and BSR operators.
        Supports Python AST and JavaScript/TypeScript/React token AST engines.
        """
        lang_lower = (language or "auto").lower().strip()
        is_jsts = (
            lang_lower in ("typescript", "javascript", "react", "ts", "js", "tsx", "jsx")
            or (lang_lower == "auto" and file_path.lower().endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")))
        )
        if is_jsts:
            return JSTSMutationEngine.generate_mutants_for_source(
                source_code=source_code,
                file_path=file_path,
                max_mutants=max_mutants,
            )

        try:
            tree = ast.parse(source_code)
        except SyntaxError as e:
            # Fallback to JS/TS engine if auto-detected source contains JS/TS constructs
            if lang_lower == "auto" and any(k in source_code for k in ("const ", "let ", "function ", "===", "=>", "export ")):
                return JSTSMutationEngine.generate_mutants_for_source(
                    source_code=source_code,
                    file_path=file_path,
                    max_mutants=max_mutants,
                )
            raise ValueError(f"Syntax error parsing {file_path} at line {e.lineno}: {e.msg}")

        source_lines = source_code.splitlines()
        mutants: List[MutantSpec] = []
        mutant_idx = 0

        for node in ast.walk(tree):
            if len(mutants) >= max_mutants:
                break

            line_no = getattr(node, "lineno", None)
            col_offset = getattr(node, "col_offset", 0)
            if line_no is None or line_no < 1 or line_no > len(source_lines):
                continue

            orig_line = source_lines[line_no - 1].strip()

            # 1. ROR: Relational Operator Replacement
            if isinstance(node, ast.Compare):
                for op_idx, op in enumerate(node.ops):
                    op_type = type(op)
                    if op_type in cls.ROR_MAP:
                        for target_class, orig_sym, mut_sym, desc in cls.ROR_MAP[op_type]:
                            mutant_idx += 1
                            mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                            # Clone tree and swap operator
                            cloned_tree = copy.deepcopy(tree)
                            target_compare = cls._find_node_at_line_col(cloned_tree, ast.Compare, line_no, col_offset)
                            if target_compare and op_idx < len(target_compare.ops):
                                target_compare.ops[op_idx] = target_class()
                                mut_source = ast.unparse(cloned_tree)
                                is_valid = cls._validate_ast_syntax(mut_source)
                                mut_snippet = orig_line.replace(orig_sym, mut_sym, 1) if orig_sym in orig_line else orig_line

                                mutants.append(
                                    MutantSpec(
                                        id=mut_id,
                                        file_path=file_path,
                                        line_number=line_no,
                                        col_offset=col_offset,
                                        operator="ROR",
                                        original_token=orig_sym,
                                        mutated_token=mut_sym,
                                        original_snippet=orig_line,
                                        mutated_snippet=mut_snippet,
                                        description=desc,
                                        mutated_source=mut_source,
                                        is_valid=is_valid,
                                        status="pending" if is_valid else "invalid",
                                    )
                                )

            # 2. AOR: Arithmetic Operator Replacement
            elif isinstance(node, ast.BinOp):
                op_type = type(node.op)
                if op_type in cls.AOR_MAP:
                    for target_class, orig_sym, mut_sym, desc in cls.AOR_MAP[op_type]:
                        mutant_idx += 1
                        mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                        cloned_tree = copy.deepcopy(tree)
                        target_binop = cls._find_node_at_line_col(cloned_tree, ast.BinOp, line_no, col_offset)
                        if target_binop:
                            target_binop.op = target_class()
                            mut_source = ast.unparse(cloned_tree)
                            is_valid = cls._validate_ast_syntax(mut_source)
                            mut_snippet = orig_line.replace(orig_sym, mut_sym, 1) if orig_sym in orig_line else orig_line

                            mutants.append(
                                MutantSpec(
                                    id=mut_id,
                                    file_path=file_path,
                                    line_number=line_no,
                                    col_offset=col_offset,
                                    operator="AOR",
                                    original_token=orig_sym,
                                    mutated_token=mut_sym,
                                    original_snippet=orig_line,
                                    mutated_snippet=mut_snippet,
                                    description=desc,
                                    mutated_source=mut_source,
                                    is_valid=is_valid,
                                    status="pending" if is_valid else "invalid",
                                )
                            )

            # 3. LCR: Logical Connector Replacement
            elif isinstance(node, ast.BoolOp):
                op_type = type(node.op)
                if op_type in cls.LCR_MAP:
                    for target_class, orig_sym, mut_sym, desc in cls.LCR_MAP[op_type]:
                        mutant_idx += 1
                        mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                        cloned_tree = copy.deepcopy(tree)
                        target_boolop = cls._find_node_at_line_col(cloned_tree, ast.BoolOp, line_no, col_offset)
                        if target_boolop:
                            target_boolop.op = target_class()
                            mut_source = ast.unparse(cloned_tree)
                            is_valid = cls._validate_ast_syntax(mut_source)
                            mut_snippet = orig_line.replace(orig_sym, mut_sym, 1) if orig_sym in orig_line else orig_line

                            mutants.append(
                                MutantSpec(
                                    id=mut_id,
                                    file_path=file_path,
                                    line_number=line_no,
                                    col_offset=col_offset,
                                    operator="LCR",
                                    original_token=orig_sym,
                                    mutated_token=mut_sym,
                                    original_snippet=orig_line,
                                    mutated_snippet=mut_snippet,
                                    description=desc,
                                    mutated_source=mut_source,
                                    is_valid=is_valid,
                                    status="pending" if is_valid else "invalid",
                                )
                            )

            # 4. BSR: Boundary Shift & Constant Inversion Replacement
            elif isinstance(node, ast.Constant):
                # Integer off-by-one boundary shift
                if isinstance(node.value, int) and not isinstance(node.value, bool):
                    if abs(node.value) <= 100000:
                        mutant_idx += 1
                        mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"
                        orig_val = node.value
                        mut_val = orig_val + 1 if orig_val == 0 else orig_val - 1

                        cloned_tree = copy.deepcopy(tree)
                        target_const = cls._find_node_at_line_col(cloned_tree, ast.Constant, line_no, col_offset)
                        if target_const:
                            target_const.value = mut_val
                            mut_source = ast.unparse(cloned_tree)
                            is_valid = cls._validate_ast_syntax(mut_source)
                            mut_snippet = orig_line.replace(str(orig_val), str(mut_val), 1)

                            mutants.append(
                                MutantSpec(
                                    id=mut_id,
                                    file_path=file_path,
                                    line_number=line_no,
                                    col_offset=col_offset,
                                    operator="BSR",
                                    original_token=str(orig_val),
                                    mutated_token=str(mut_val),
                                    original_snippet=orig_line,
                                    mutated_snippet=mut_snippet,
                                    description=f"Boundary Shift: constant integer {orig_val} shifted to {mut_val}",
                                    mutated_source=mut_source,
                                    is_valid=is_valid,
                                    status="pending" if is_valid else "invalid",
                                )
                            )

                # Boolean inversion (True <-> False)
                elif isinstance(node.value, bool):
                    mutant_idx += 1
                    mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"
                    orig_val = node.value
                    mut_val = not orig_val

                    cloned_tree = copy.deepcopy(tree)
                    target_const = cls._find_node_at_line_col(cloned_tree, ast.Constant, line_no, col_offset)
                    if target_const:
                        target_const.value = mut_val
                        mut_source = ast.unparse(cloned_tree)
                        is_valid = cls._validate_ast_syntax(mut_source)
                        mut_snippet = orig_line.replace(str(orig_val), str(mut_val), 1)

                        mutants.append(
                            MutantSpec(
                                id=mut_id,
                                file_path=file_path,
                                line_number=line_no,
                                col_offset=col_offset,
                                operator="BSR",
                                original_token=str(orig_val),
                                mutated_token=str(mut_val),
                                original_snippet=orig_line,
                                mutated_snippet=mut_snippet,
                                description=f"Boundary Shift: boolean flag {orig_val} inverted to {mut_val}",
                                mutated_source=mut_source,
                                is_valid=is_valid,
                                status="pending" if is_valid else "invalid",
                            )
                        )

        # Apply heuristic detection for suspected equivalent mutants
        cls._flag_suspected_equivalent_mutants(mutants, tree)

        return mutants

    @classmethod
    def _find_node_at_line_col(cls, tree: ast.AST, node_type: type, line_no: int, col_offset: int) -> Optional[Any]:
        """Locates the exact AST node matching type, line, and column in a cloned AST."""
        for node in ast.walk(tree):
            if isinstance(node, node_type):
                if getattr(node, "lineno", None) == line_no and getattr(node, "col_offset", None) == col_offset:
                    return node
        # Fallback: line number match only
        for node in ast.walk(tree):
            if isinstance(node, node_type) and getattr(node, "lineno", None) == line_no:
                return node
        return None

    @classmethod
    def _validate_ast_syntax(cls, source_code: str) -> bool:
        """Ensures mutated source compiles without syntax or semantic errors."""
        try:
            compile(source_code, filename="<mutant>", mode="exec")
            return True
        except (SyntaxError, ValueError):
            return False

    @classmethod
    def _flag_suspected_equivalent_mutants(cls, mutants: List[MutantSpec], tree: Optional[ast.AST] = None) -> None:
        """
        Heuristically flags mutants that are likely semantically equivalent to original code,
        such as commutativity changes where behavior cannot differ, or untestable interactive
        CLI / terminal routines (calls to input, getpass, sys.exit, or __main__ blocks).
        """
        interactive_lines = set()
        if tree is not None:
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    is_interactive = False
                    for child in ast.walk(node):
                        if isinstance(child, ast.Call):
                            if isinstance(child.func, ast.Name) and child.func.id in ("input", "raw_input", "getpass", "exit", "quit"):
                                is_interactive = True
                                break
                            if isinstance(child.func, ast.Attribute) and child.func.attr in ("exit", "_exit"):
                                is_interactive = True
                                break
                        elif isinstance(child, ast.Attribute) and child.attr == "stdin":
                            is_interactive = True
                            break
                    if is_interactive:
                        start_line = node.lineno
                        end_line = getattr(node, "end_lineno", start_line)
                        for ln in range(start_line, end_line + 1):
                            interactive_lines.add(ln)

                elif isinstance(node, ast.If):
                    try:
                        test_src = ast.unparse(node.test)
                        if "__name__" in test_src and "__main__" in test_src:
                            start_line = node.lineno
                            end_line = getattr(node, "end_lineno", start_line)
                            for ln in range(start_line, end_line + 1):
                                interactive_lines.add(ln)
                    except Exception:
                        pass

                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
                    start_line = node.lineno
                    end_line = getattr(node, "end_lineno", start_line)
                    for ln in range(start_line, end_line + 1):
                        interactive_lines.add(ln)

        for m in mutants:
            # Identity operations on boolean constants (e.g. True or False)
            if "if True or False" in m.mutated_snippet or "if False or True" in m.mutated_snippet:
                m.is_equivalent = True
                m.status = "equivalent"
                m.description += " [Suspected Equivalent Mutant]"
            elif m.line_number in interactive_lines:
                m.is_equivalent = True
                m.status = "equivalent"
                m.description += " [Interactive CLI Routine / Cosmetic Output - Untestable via unit testing]"


class JSTSMutationEngine:
    """
    Analyzes JavaScript, TypeScript, and React JSX/TSX source code and generates
    systematic semantic mutations across ROR, AOR, LCR, and BSR operator catalogs.
    Safely ignores string literals, comments, import statements, and JSX tags.
    """

    # ROR: ordered by length descending so === matches before ==, >= before >
    ROR_OPERATORS = [
        ("===", "!==", "Relational: strict equality (===) to strict inequality (!==)"),
        ("!==", "===", "Relational: strict inequality (!==) to strict equality (===)"),
        ("==", "!=", "Relational: equality (==) to inequality (!=)"),
        ("!=", "==", "Relational: inequality (!=) to equality (==)"),
        (">=", ">", "Relational: greater or equal (>=) to strictly greater (>)"),
        ("<=", "<", "Relational: less or equal (<=) to strictly less (<)"),
        (">", ">=", "Relational: strictly greater than (>) to greater or equal (>=)"),
        ("<", "<=", "Relational: strictly less than (<) to less or equal (<=)"),
    ]

    # AOR: Arithmetic operators
    AOR_OPERATORS = [
        ("+", "-", "Arithmetic: addition (+) to subtraction (-)"),
        ("-", "+", "Arithmetic: subtraction (-) to addition (+)"),
        ("*", "/", "Arithmetic: multiplication (*) to division (/)"),
        ("/", "*", "Arithmetic: division (/) to multiplication (*)"),
        ("%", "*", "Arithmetic: modulo (%) to multiplication (*)"),
    ]

    # LCR: Logical operators
    LCR_OPERATORS = [
        ("&&", "||", "Logical: connector conjunction (&&) to disjunction (||)"),
        ("||", "&&", "Logical: connector disjunction (||) to conjunction (&&)"),
        ("??", "||", "Nullish coalescing: (??) to logical disjunction (||)"),
    ]

    @classmethod
    def generate_mutants_for_source(
        cls,
        source_code: str,
        file_path: str = "solution.ts",
        max_mutants: int = 50,
    ) -> List[MutantSpec]:
        source_lines = source_code.splitlines()
        mutants: List[MutantSpec] = []
        mutant_idx = 0

        # Precompute line comment and string literal masks
        line_masks = cls._mask_lines(source_lines)

        for line_no, (line_text, active_line) in enumerate(zip(source_lines, line_masks), start=1):
            if len(mutants) >= max_mutants:
                break

            s = line_text.strip()
            # Skip empty, comment-only, or import/export lines
            if not s or s.startswith("//") or s.startswith("/*") or s.startswith("*"):
                continue
            if s.startswith("import ") or s.startswith("export type ") or s.startswith("export interface "):
                continue

            # 1. ROR Relational Operators
            for orig_op, mut_op, desc in cls.ROR_OPERATORS:
                if len(mutants) >= max_mutants:
                    break
                col_offset = 0
                while col_offset < len(active_line):
                    idx = active_line.find(orig_op, col_offset)
                    if idx == -1:
                        break

                    if cls._is_subtoken_of_longer_op(active_line, idx, orig_op):
                        col_offset = idx + len(orig_op)
                        continue

                    if cls._is_jsx_tag_bracket(line_text, idx, orig_op):
                        col_offset = idx + len(orig_op)
                        continue

                    mutant_idx += 1
                    mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                    mut_line = line_text[:idx] + mut_op + line_text[idx + len(orig_op):]
                    mut_lines = list(source_lines)
                    mut_lines[line_no - 1] = mut_line
                    mut_source = "\n".join(mut_lines)

                    is_valid = cls._validate_syntax(mut_source)
                    is_equiv = cls._is_suspected_equivalent(line_text, orig_op, mut_op)

                    mutants.append(
                        MutantSpec(
                            id=mut_id,
                            file_path=file_path,
                            line_number=line_no,
                            col_offset=idx,
                            operator="ROR",
                            original_token=orig_op,
                            mutated_token=mut_op,
                            original_snippet=s,
                            mutated_snippet=mut_line.strip(),
                            description=desc,
                            mutated_source=mut_source,
                            is_valid=is_valid,
                            is_equivalent=is_equiv,
                            status="equivalent" if is_equiv else ("pending" if is_valid else "invalid"),
                        )
                    )

                    col_offset = idx + len(orig_op)

            # 2. LCR Logical Operators
            for orig_op, mut_op, desc in cls.LCR_OPERATORS:
                if len(mutants) >= max_mutants:
                    break
                col_offset = 0
                while col_offset < len(active_line):
                    idx = active_line.find(orig_op, col_offset)
                    if idx == -1:
                        break

                    if cls._is_subtoken_of_longer_op(active_line, idx, orig_op):
                        col_offset = idx + len(orig_op)
                        continue

                    mutant_idx += 1
                    mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                    mut_line = line_text[:idx] + mut_op + line_text[idx + len(orig_op):]
                    mut_lines = list(source_lines)
                    mut_lines[line_no - 1] = mut_line
                    mut_source = "\n".join(mut_lines)

                    is_valid = cls._validate_syntax(mut_source)
                    is_equiv = cls._is_suspected_equivalent(line_text, orig_op, mut_op)

                    mutants.append(
                        MutantSpec(
                            id=mut_id,
                            file_path=file_path,
                            line_number=line_no,
                            col_offset=idx,
                            operator="LCR",
                            original_token=orig_op,
                            mutated_token=mut_op,
                            original_snippet=s,
                            mutated_snippet=mut_line.strip(),
                            description=desc,
                            mutated_source=mut_source,
                            is_valid=is_valid,
                            is_equivalent=is_equiv,
                            status="equivalent" if is_equiv else ("pending" if is_valid else "invalid"),
                        )
                    )

                    col_offset = idx + len(orig_op)

            # 3. AOR Arithmetic Operators
            for orig_op, mut_op, desc in cls.AOR_OPERATORS:
                if len(mutants) >= max_mutants:
                    break
                col_offset = 0
                while col_offset < len(active_line):
                    idx = active_line.find(orig_op, col_offset)
                    if idx == -1:
                        break

                    if cls._is_compound_arithmetic_op(active_line, idx, orig_op):
                        col_offset = idx + len(orig_op)
                        continue

                    if cls._is_jsx_tag_bracket(line_text, idx, orig_op):
                        col_offset = idx + len(orig_op)
                        continue

                    mutant_idx += 1
                    mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                    mut_line = line_text[:idx] + mut_op + line_text[idx + len(orig_op):]
                    mut_lines = list(source_lines)
                    mut_lines[line_no - 1] = mut_line
                    mut_source = "\n".join(mut_lines)

                    is_valid = cls._validate_syntax(mut_source)
                    is_equiv = cls._is_suspected_equivalent(line_text, orig_op, mut_op)

                    mutants.append(
                        MutantSpec(
                            id=mut_id,
                            file_path=file_path,
                            line_number=line_no,
                            col_offset=idx,
                            operator="AOR",
                            original_token=orig_op,
                            mutated_token=mut_op,
                            original_snippet=s,
                            mutated_snippet=mut_line.strip(),
                            description=desc,
                            mutated_source=mut_source,
                            is_valid=is_valid,
                            is_equivalent=is_equiv,
                            status="equivalent" if is_equiv else ("pending" if is_valid else "invalid"),
                        )
                    )

                    col_offset = idx + len(orig_op)

            # 4. BSR Boundary Shift: boolean constants
            for bool_match in re.finditer(r'\b(true|false)\b', active_line):
                if len(mutants) >= max_mutants:
                    break
                orig_bool = bool_match.group(1)
                mut_bool = "false" if orig_bool == "true" else "true"
                idx = bool_match.start()

                mutant_idx += 1
                mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                mut_line = line_text[:idx] + mut_bool + line_text[idx + len(orig_bool):]
                mut_lines = list(source_lines)
                mut_lines[line_no - 1] = mut_line
                mut_source = "\n".join(mut_lines)

                is_valid = cls._validate_syntax(mut_source)
                is_equiv = cls._is_suspected_equivalent(line_text, orig_bool, mut_bool)

                mutants.append(
                    MutantSpec(
                        id=mut_id,
                        file_path=file_path,
                        line_number=line_no,
                        col_offset=idx,
                        operator="BSR",
                        original_token=orig_bool,
                        mutated_token=mut_bool,
                        original_snippet=s,
                        mutated_snippet=mut_line.strip(),
                        description=f"Boundary Shift: boolean flag {orig_bool} inverted to {mut_bool}",
                        mutated_source=mut_source,
                        is_valid=is_valid,
                        is_equivalent=is_equiv,
                        status="equivalent" if is_equiv else ("pending" if is_valid else "invalid"),
                    )
                )

            # 5. BSR Boundary Shift: integer constants
            for int_match in re.finditer(r'(?<![a-zA-Z0-9_$.])\b(\d+)\b(?![a-zA-Z0-9_$.])', active_line):
                if len(mutants) >= max_mutants:
                    break
                orig_int_str = int_match.group(1)
                val = int(orig_int_str)
                if val > 100000:
                    continue
                mut_val = val + 1 if val == 0 else val - 1
                mut_int_str = str(mut_val)
                idx = int_match.start()

                mutant_idx += 1
                mut_id = f"MUT-{file_path}-{line_no}-{mutant_idx}"

                mut_line = line_text[:idx] + mut_int_str + line_text[idx + len(orig_int_str):]
                mut_lines = list(source_lines)
                mut_lines[line_no - 1] = mut_line
                mut_source = "\n".join(mut_lines)

                is_valid = cls._validate_syntax(mut_source)
                is_equiv = cls._is_suspected_equivalent(line_text, orig_int_str, mut_int_str)

                mutants.append(
                    MutantSpec(
                        id=mut_id,
                        file_path=file_path,
                        line_number=line_no,
                        col_offset=idx,
                        operator="BSR",
                        original_token=orig_int_str,
                        mutated_token=mut_int_str,
                        original_snippet=s,
                        mutated_snippet=mut_line.strip(),
                        description=f"Boundary Shift: integer constant {orig_int_str} shifted to {mut_int_str}",
                        mutated_source=mut_source,
                        is_valid=is_valid,
                        is_equivalent=is_equiv,
                        status="equivalent" if is_equiv else ("pending" if is_valid else "invalid"),
                    )
                )

        return mutants

    @classmethod
    def _mask_lines(cls, source_lines: List[str]) -> List[str]:
        full_text = "\n".join(source_lines)
        masked_chars = list(full_text)

        # 1. Multi-line comments /* ... */
        for m in re.finditer(r'/\*[\s\S]*?\*/', full_text):
            for i in range(m.start(), m.end()):
                if full_text[i] != '\n':
                    masked_chars[i] = ' '

        # 2. Single-line comments // ...
        for m in re.finditer(r'//[^\n]*', "".join(masked_chars)):
            for i in range(m.start(), m.end()):
                masked_chars[i] = ' '

        # 3. String literals: "...", '...', `...`
        temp_str = "".join(masked_chars)
        for m in re.finditer(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`', temp_str):
            start, end = m.start(), m.end()
            for i in range(start + 1, end - 1):
                if full_text[i] != '\n':
                    masked_chars[i] = ' '

        masked_full = "".join(masked_chars)
        return masked_full.split("\n")

    @classmethod
    def _is_subtoken_of_longer_op(cls, line: str, idx: int, op: str) -> bool:
        prev_char = line[idx - 1] if idx > 0 else ""
        next_char = line[idx + len(op)] if idx + len(op) < len(line) else ""

        if op == "==":
            return prev_char in ("!", "=") or next_char == "="
        if op == "!=":
            return next_char == "="
        if op == ">":
            return prev_char in ("=", "-") or next_char in ("=", ">")
        if op == "<":
            return next_char in ("=", "<")
        if op in (">=", "<="):
            return next_char == "="
        if op in ("&&", "||"):
            return next_char == "="
        return False

    @classmethod
    def _is_compound_arithmetic_op(cls, line: str, idx: int, op: str) -> bool:
        prev_char = line[idx - 1] if idx > 0 else ""
        next_char = line[idx + len(op)] if idx + len(op) < len(line) else ""

        if op == "+":
            return prev_char == "+" or next_char in ("+", "=")
        if op == "-":
            return prev_char == "-" or next_char in ("-", "=", ">")
        if op == "*":
            return prev_char == "*" or next_char in ("*", "=", "/")
        if op == "/":
            return prev_char == "*" or next_char in ("/", "*", "=")
        if op == "%":
            return next_char == "="
        return False

    @classmethod
    def _is_jsx_tag_bracket(cls, line: str, idx: int, op: str) -> bool:
        if op == "<":
            next_char = line[idx + 1] if idx + 1 < len(line) else ""
            return bool(re.match(r'[a-zA-Z/_!]', next_char))
        if op == ">":
            prev_char = line[idx - 1] if idx > 0 else ""
            if prev_char == "/":
                return True
            # Preceded by tag identifier or quote and closing a tag
            prefix = line[:idx]
            last_open = prefix.rfind("<")
            if last_open != -1:
                tag_content = prefix[last_open + 1:].strip()
                if tag_content and re.match(r'^[a-zA-Z/]', tag_content):
                    return True
        if op == "/":
            prev_char = line[idx - 1] if idx > 0 else ""
            next_char = line[idx + 1] if idx + 1 < len(line) else ""
            if prev_char == "<" or next_char == ">":
                return True
            prefix = line[:idx]
            last_open = prefix.rfind("<")
            last_close = prefix.rfind(">")
            if last_open != -1 and last_open > last_close:
                return True
        return False

    @classmethod
    def _validate_syntax(cls, source_code: str) -> bool:
        """Lightweight delimiter balance validation for candidate mutations."""
        stack = []
        matching = {')': '(', '}': '{', ']': '['}
        in_dquote = False
        in_squote = False
        in_tick = False
        escaped = False

        for char in source_code:
            if escaped:
                escaped = False
                continue
            if char == '\\':
                escaped = True
                continue

            if char == '"' and not in_squote and not in_tick:
                in_dquote = not in_dquote
                continue
            if char == "'" and not in_dquote and not in_tick:
                in_squote = not in_squote
                continue
            if char == '`' and not in_dquote and not in_squote:
                in_tick = not in_tick
                continue

            if in_dquote or in_squote or in_tick:
                continue

            if char in ('(', '{', '['):
                stack.append(char)
            elif char in (')', '}', ']'):
                if not stack or stack[-1] != matching[char]:
                    return False
                stack.pop()

        return len(stack) == 0 and not (in_dquote or in_squote or in_tick)

    @classmethod
    def _is_suspected_equivalent(cls, line_text: str, orig: str, mut: str) -> bool:
        if any(k in line_text for k in ("console.", "process.exit", "window.alert", "alert(")):
            return True
        if "true || false" in line_text or "false || true" in line_text:
            return True
        return False
