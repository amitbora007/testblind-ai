import os
import tempfile
import pytest
from pathlib import Path

from app.services.impact_analysis import TestImpactAnalyzer


def test_build_dependency_map_and_impact():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        tests_dir = tmp_path / "tests"
        tests_dir.mkdir()

        # Create source files
        (tmp_path / "auth.py").write_text("def authenticate(): return True\n")
        (tmp_path / "billing.py").write_text("def charge(): return 100\n")
        (tmp_path / "utils.py").write_text("def helper(): pass\n")

        # Create test files
        (tests_dir / "test_auth.py").write_text(
            "import pytest\n"
            "from auth import authenticate\n"
            "def test_auth(): assert authenticate() is True\n"
        )
        (tests_dir / "test_billing.py").write_text(
            "import pytest\n"
            "from billing import charge\n"
            "from utils import helper\n"
            "def test_charge(): assert charge() == 100\n"
        )

        dep_map = TestImpactAnalyzer.build_dependency_map(tmpdir)
        assert "auth" in dep_map
        assert "tests/test_auth.py" in dep_map["auth"]
        assert "billing" in dep_map
        assert "tests/test_billing.py" in dep_map["billing"]
        assert "utils" in dep_map
        assert "tests/test_billing.py" in dep_map["utils"]

        # Test targeted impacts
        auth_impacted = TestImpactAnalyzer.get_impacted_tests(tmpdir, "auth.py")
        assert auth_impacted == ["tests/test_auth.py"]

        billing_impacted = TestImpactAnalyzer.get_impacted_tests(tmpdir, "billing.py")
        assert billing_impacted == ["tests/test_billing.py"]

        utils_impacted = TestImpactAnalyzer.get_impacted_tests(tmpdir, "utils.py")
        assert utils_impacted == ["tests/test_billing.py"]

        # Test construct_targeted_pytest_command
        cmd = TestImpactAnalyzer.construct_targeted_pytest_command(tmpdir, "auth.py")
        assert "tests/test_auth.py" in cmd
        assert "tests/test_billing.py" not in cmd
