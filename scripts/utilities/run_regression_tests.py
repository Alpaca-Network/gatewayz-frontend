#!/usr/bin/env python3
"""
Convenience script to run regression tests with various options.

Usage:
    python run_regression_tests.py              # Run all regression tests
    python run_regression_tests.py --critical   # Run only critical endpoint tests
    python run_regression_tests.py --chat       # Run only chat endpoint tests
    python run_regression_tests.py --coverage   # Run with coverage report
"""

import sys
import subprocess
import argparse


def run_tests(args):
    """Run pytest with appropriate flags"""
    cmd = ["pytest", "tests/test_endpoint_regression.py", "-v", "--tb=short", "--color=yes"]

    if args.critical:
        print("🔍 Running critical endpoint tests only...")
        cmd.append("-k")
        cmd.append("critical or chat or responses")
    elif args.chat:
        print("💬 Running chat endpoint tests only...")
        cmd.append("-k")
        cmd.append("chat or responses")
    elif args.health:
        print("❤️  Running health check tests only...")
        cmd.append("-k")
        cmd.append("health")

    if args.coverage:
        print("📊 Running with coverage report...")
        cmd.extend(["--cov=src", "--cov-report=term", "--cov-report=html"])

    if args.verbose:
        cmd.append("-vv")

    if args.failfast:
        cmd.append("-x")

    print(f"\n🚀 Running: {' '.join(cmd)}\n")

    result = subprocess.run(cmd)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(
        description="Run endpoint regression tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_regression_tests.py                    # All tests
  python run_regression_tests.py --critical         # Critical endpoints
  python run_regression_tests.py --chat             # Chat endpoints
  python run_regression_tests.py --coverage         # With coverage
  python run_regression_tests.py --failfast         # Stop on first failure
        """
    )

    parser.add_argument(
        "--critical",
        action="store_true",
        help="Run only critical endpoint tests"
    )

    parser.add_argument(
        "--chat",
        action="store_true",
        help="Run only chat-related endpoint tests"
    )

    parser.add_argument(
        "--health",
        action="store_true",
        help="Run only health check tests"
    )

    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Run tests with coverage report"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    parser.add_argument(
        "--failfast", "-x",
        action="store_true",
        help="Stop on first failure"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("🧪 ENDPOINT REGRESSION TEST SUITE")
    print("=" * 70)

    exit_code = run_tests(args)

    if exit_code == 0:
        print("\n" + "=" * 70)
        print("✅ All tests passed!")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("❌ Some tests failed! Check the output above.")
        print("=" * 70)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
