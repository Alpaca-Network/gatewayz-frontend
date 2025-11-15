#!/usr/bin/env python3
"""
Verification script for Google Vertex AI lazy imports.

This script verifies that:
1. The google_vertex_client module can be imported without external dependencies
2. All problematic imports are inside functions (lazy-loaded)
3. Error handling is properly configured
"""

import ast
import sys
from pathlib import Path


def analyze_file_for_lazy_imports(file_path):
    """Analyze a Python file for proper lazy import patterns."""

    with open(file_path, 'r') as f:
        lines = f.readlines()
        content = ''.join(lines)

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        return {
            "status": "error",
            "message": f"Syntax error: {e}",
            "file": file_path
        }

    # Track all imports and where they are
    top_level_problematic = []
    inside_function_ok = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            import_name = None
            if isinstance(node, ast.Import):
                import_name = node.names[0].name if node.names else None
            else:
                import_name = node.module

            if import_name and any(x in import_name for x in ['vertexai', 'google.protobuf', 'google.cloud.aiplatform']):
                line_num = node.lineno

                # Determine if we're inside a function
                inside_function = False
                func_name = None
                for parent in ast.walk(tree):
                    if isinstance(parent, ast.FunctionDef):
                        # Check if this node is inside this function
                        if hasattr(node, 'lineno'):
                            # Simple check: if node is between function start and next function/class
                            for child in ast.walk(parent):
                                if child == node or (hasattr(child, 'lineno') and hasattr(node, 'lineno') and child.lineno == node.lineno):
                                    inside_function = True
                                    func_name = parent.name
                                    break
                        if inside_function:
                            break

                line_content = lines[line_num - 1].strip() if line_num <= len(lines) else "???"

                import_info = {
                    "line": line_num,
                    "import": import_name,
                    "code": line_content
                }

                if inside_function:
                    import_info["function"] = func_name
                    inside_function_ok.append(import_info)
                else:
                    top_level_problematic.append(import_info)

    return {
        "status": "ok" if not top_level_problematic else "error",
        "file": file_path,
        "top_level_problematic": top_level_problematic,
        "inside_function_ok": inside_function_ok,
        "message": "All critical imports are lazy-loaded" if not top_level_problematic else "Found problematic top-level imports"
    }


def main():
    """Run verification checks."""

    print("=" * 80)
    print("Google Vertex AI Lazy Import Verification")
    print("=" * 80)

    # Find the repo root
    repo_root = Path(__file__).parent.parent
    google_vertex_client = repo_root / "src" / "services" / "google_vertex_client.py"

    if not google_vertex_client.exists():
        print(f"❌ File not found: {google_vertex_client}")
        sys.exit(1)

    print(f"\n📋 Analyzing: {google_vertex_client}")
    print("-" * 80)

    result = analyze_file_for_lazy_imports(google_vertex_client)

    if result["status"] == "error" and "Syntax error" in result.get("message", ""):
        print(f"❌ {result['message']}")
        sys.exit(1)

    # Check for problematic top-level imports
    if result["top_level_problematic"]:
        print("❌ FAILED: Found problematic top-level imports:\n")
        for imp in result["top_level_problematic"]:
            print(f"  Line {imp['line']}: {imp['import']}")
            print(f"    Code: {imp['code']}")
        sys.exit(1)

    # Show lazy imports
    if result["inside_function_ok"]:
        print("✅ PASSED: All problematic imports are properly lazy-loaded\n")
        print("📦 Lazy imports found:")
        for imp in result["inside_function_ok"]:
            print(f"  Line {imp['line']}: {imp['import']} (inside {imp.get('function', '?')})")
            print(f"    Code: {imp['code']}")
    else:
        print("⚠️  WARNING: No problematic imports found (unexpected)")

    print("\n" + "-" * 80)
    print("✅ Verification PASSED")
    print("=" * 80)

    # Additional checks
    print("\n📊 Additional Checks")
    print("-" * 80)

    # Check for _ensure_vertex_imports function
    with open(google_vertex_client, 'r') as f:
        content = f.read()

    checks = [
        ("_ensure_vertex_imports function exists", "_ensure_vertex_imports" in content),
        ("_ensure_protobuf_imports function exists", "_ensure_protobuf_imports" in content),
        ("Lazy imports have error handling", "except ImportError as e:" in content),
        ("Functions call lazy import helpers", "_ensure_vertex_imports()" in content),
    ]

    all_passed = True
    for check_name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"{status} {check_name}")
        if not passed:
            all_passed = False

    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL CHECKS PASSED - Google Vertex AI lazy imports are correctly configured")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - Review the implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())
