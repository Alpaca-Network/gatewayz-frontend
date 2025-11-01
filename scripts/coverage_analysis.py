#!/usr/bin/env python3
"""
Coverage Analysis Tool for Gatewayz Backend

Analyzes test coverage and identifies gaps in testing.
Provides actionable recommendations for improving coverage.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def find_source_files(directory: str = "src") -> List[Path]:
    """Find all Python source files"""
    src_path = project_root / directory
    return list(src_path.rglob("*.py"))


def find_test_files(directory: str = "tests") -> List[Path]:
    """Find all test files"""
    tests_path = project_root / directory
    return list(tests_path.rglob("test_*.py"))


def analyze_coverage_json() -> Dict:
    """Analyze coverage.json if it exists"""
    coverage_file = project_root / "coverage.json"

    if not coverage_file.exists():
        return {}

    with open(coverage_file) as f:
        return json.load(f)


def get_module_coverage(coverage_data: Dict) -> Dict[str, float]:
    """Get coverage percentage by module"""
    if not coverage_data or "files" not in coverage_data:
        return {}

    module_coverage = {}

    for file_path, data in coverage_data["files"].items():
        if not file_path.startswith("src/"):
            continue

        # Extract module (routes, services, db, etc.)
        parts = file_path.split("/")
        if len(parts) < 2:
            continue

        module = parts[1]

        # Calculate coverage for this file
        summary = data.get("summary", {})
        total_statements = summary.get("num_statements", 0)
        covered = summary.get("covered_lines", 0)

        if total_statements > 0:
            coverage_pct = (covered / total_statements) * 100
        else:
            coverage_pct = 0

        if module not in module_coverage:
            module_coverage[module] = {"total": 0, "covered": 0, "files": 0}

        module_coverage[module]["total"] += total_statements
        module_coverage[module]["covered"] += covered
        module_coverage[module]["files"] += 1

    # Calculate percentages
    result = {}
    for module, data in module_coverage.items():
        if data["total"] > 0:
            result[module] = (data["covered"] / data["total"]) * 100
        else:
            result[module] = 0

    return result


def find_untested_modules() -> Dict[str, List[str]]:
    """Find source files without corresponding tests"""
    source_files = find_source_files()
    test_files = find_test_files()

    # Extract module names from test files
    tested_modules = set()
    for test_file in test_files:
        name = test_file.stem.replace("test_", "")
        tested_modules.add(name)

    # Find untested source files
    untested = {
        "routes": [],
        "services": [],
        "db": [],
        "security": [],
        "utils": [],
        "models": [],
        "config": [],
        "schemas": [],
    }

    for source_file in source_files:
        if source_file.name == "__init__.py":
            continue

        # Determine module category
        parts = source_file.parts
        if "src" not in parts:
            continue

        src_idx = parts.index("src")
        if src_idx + 1 >= len(parts):
            continue

        category = parts[src_idx + 1]
        module_name = source_file.stem

        # Check if tested
        if module_name not in tested_modules and category in untested:
            untested[category].append(module_name)

    # Remove empty categories
    return {k: v for k, v in untested.items() if v}


def print_analysis():
    """Print comprehensive coverage analysis"""
    print("=" * 80)
    print("📊 GATEWAYZ BACKEND - COVERAGE ANALYSIS")
    print("=" * 80)
    print()

    # Count files
    source_files = find_source_files()
    test_files = find_test_files()

    print(f"📁 Source Files:    {len(source_files)}")
    print(f"🧪 Test Files:      {len(test_files)}")
    print(f"📈 Test/Source:     {len(test_files) / len(source_files) * 100:.1f}%")
    print()

    # Module coverage
    coverage_data = analyze_coverage_json()
    if coverage_data:
        module_cov = get_module_coverage(coverage_data)

        print("=" * 80)
        print("📊 COVERAGE BY MODULE")
        print("=" * 80)
        print()

        for module, coverage in sorted(module_cov.items(), key=lambda x: x[1]):
            bar_length = int(coverage / 2)
            bar = "█" * bar_length + "░" * (50 - bar_length)
            print(f"{module:20s} {bar} {coverage:5.1f}%")
        print()

    # Untested modules
    untested = find_untested_modules()

    print("=" * 80)
    print("🔴 UNTESTED MODULES (High Priority)")
    print("=" * 80)
    print()

    priority_order = ["routes", "services", "security", "db", "utils", "models", "config", "schemas"]

    for category in priority_order:
        if category in untested and untested[category]:
            print(f"\n{category.upper()}:")
            for i, module in enumerate(sorted(untested[category]), 1):
                print(f"  {i:2d}. {module}")

    print()
    print("=" * 80)
    print("💡 RECOMMENDATIONS")
    print("=" * 80)
    print()

    total_untested = sum(len(v) for v in untested.values())

    print(f"1. Create tests for {total_untested} untested modules")
    print(f"2. Prioritize: security → routes → services → db")
    print(f"3. Target: Add 15-20 tests per week")
    print(f"4. Use: pytest tests/ --cov=src --cov-report=html")
    print()

    # Calculate how many tests needed per category
    if "routes" in untested:
        print(f"📍 Routes: {len(untested['routes'])} files need tests")
    if "services" in untested:
        print(f"📍 Services: {len(untested['services'])} files need tests")
    if "security" in untested:
        print(f"📍 Security: {len(untested['security'])} files need tests (CRITICAL!)")

    print()
    print("✅ Run './scripts/coverage_report.sh' for detailed coverage report")
    print()


if __name__ == "__main__":
    try:
        print_analysis()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
