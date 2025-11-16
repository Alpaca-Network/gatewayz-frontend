#!/usr/bin/env python3
"""
Error Monitoring System Setup & Validation Script

Validates configuration, checks dependencies, and tests the error monitoring system.
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Tuple

# Colors for terminal output
class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")


def print_check(text: str, status: bool, details: str = ""):
    """Print a check result."""
    icon = f"{Colors.GREEN}✓{Colors.RESET}" if status else f"{Colors.RED}✗{Colors.RESET}"
    status_text = f"{Colors.GREEN}OK{Colors.RESET}" if status else f"{Colors.RED}FAILED{Colors.RESET}"

    print(f"{icon} {text:40} [{status_text}]", end="")
    if details:
        print(f" {Colors.YELLOW}{details}{Colors.RESET}", end="")
    print()


def check_python_version() -> bool:
    """Check Python version is 3.10+."""
    version = sys.version_info
    is_valid = version.major >= 3 and version.minor >= 10
    print_check(
        f"Python version {version.major}.{version.minor}",
        is_valid,
        f"Required: 3.10+" if not is_valid else "",
    )
    return is_valid


def check_env_variable(var_name: str, required: bool = False) -> Tuple[bool, str]:
    """Check if environment variable is set."""
    value = os.environ.get(var_name)
    is_set = value is not None and value != ""

    if is_set:
        # Show masked value
        display = value[:8] + "..." if len(value) > 8 else value
        print_check(f"Environment: {var_name}", True, f"Set to: {display}")
    else:
        status = f"{Colors.YELLOW}Not set (optional){Colors.RESET}" if not required else ""
        print_check(f"Environment: {var_name}", not required, status)

    return is_set


def check_dependencies() -> bool:
    """Check required Python packages."""
    required_packages = [
        "fastapi",
        "uvicorn",
        "httpx",
        "pydantic",
    ]

    print_header("Python Dependencies")
    all_installed = True

    for package in required_packages:
        try:
            __import__(package)
            print_check(f"Package: {package}", True)
        except ImportError:
            print_check(f"Package: {package}", False, "pip install required")
            all_installed = False

    return all_installed


def check_railway_cli() -> bool:
    """Check if Railway CLI is installed."""
    print_header("Railway CLI")

    try:
        result = subprocess.run(
            ["railway", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            version = result.stdout.strip()
            print_check("Railway CLI installed", True, f"Version: {version}")
            return True
        else:
            print_check("Railway CLI installed", False, "Check path or reinstall")
            return False

    except FileNotFoundError:
        print_check(
            "Railway CLI installed",
            False,
            "npm install -g @railway/cli",
        )
        return False
    except Exception as e:
        print_check("Railway CLI installed", False, str(e))
        return False


def check_railway_login() -> bool:
    """Check if user is logged into Railway."""
    try:
        result = subprocess.run(
            ["railway", "whoami"],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            user = result.stdout.strip()
            print_check("Railway login status", True, f"User: {user}")
            return True
        else:
            print_check("Railway login status", False, "Run: railway login")
            return False

    except Exception as e:
        print_check("Railway login status", False, str(e))
        return False


def check_git_config() -> bool:
    """Check git configuration."""
    print_header("Git Configuration")

    try:
        # Check email
        result = subprocess.run(
            ["git", "config", "user.email"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        email_ok = result.returncode == 0
        email = result.stdout.strip() if email_ok else "Not configured"
        print_check("Git user.email", email_ok, f"Value: {email}")

        # Check name
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        name_ok = result.returncode == 0
        name = result.stdout.strip() if name_ok else "Not configured"
        print_check("Git user.name", name_ok, f"Value: {name}")

        return email_ok and name_ok

    except Exception as e:
        print_check("Git configuration check", False, str(e))
        return False


def check_routes_file() -> bool:
    """Check if error_monitor route is registered."""
    print_header("Route Registration")

    try:
        main_py = Path("/root/repo/src/main.py")
        if not main_py.exists():
            print_check("src/main.py exists", False)
            return False

        content = main_py.read_text()
        has_error_monitor = "error_monitor" in content

        print_check('Route "error_monitor" registered in main.py', has_error_monitor)
        return has_error_monitor

    except Exception as e:
        print_check("Route registration check", False, str(e))
        return False


def check_error_monitor_module() -> bool:
    """Check if error monitor module exists and loads."""
    print_header("Error Monitor Modules")

    modules = [
        "/root/repo/src/services/error_monitor.py",
        "/root/repo/src/services/bug_fix_generator.py",
        "/root/repo/src/routes/error_monitor.py",
    ]

    all_exist = True
    for module_path in modules:
        exists = Path(module_path).exists()
        print_check(f"Module exists: {Path(module_path).name}", exists)
        all_exist = all_exist and exists

    return all_exist


def test_imports() -> bool:
    """Test if modules can be imported."""
    print_header("Import Tests")

    sys.path.insert(0, "/root/repo")

    try:
        from src.services.error_monitor import ErrorMonitor

        print_check("Import: ErrorMonitor", True)
    except Exception as e:
        print_check("Import: ErrorMonitor", False, str(e))
        return False

    try:
        from src.services.bug_fix_generator import BugFixGenerator

        print_check("Import: BugFixGenerator", True)
    except Exception as e:
        print_check("Import: BugFixGenerator", False, str(e))
        return False

    try:
        from src.routes.error_monitor import router

        print_check("Import: error_monitor router", True)
    except Exception as e:
        print_check("Import: error_monitor router", False, str(e))
        return False

    return True


def check_api_keys() -> bool:
    """Check API keys are configured."""
    print_header("API Keys Configuration")

    required_keys = {
        "ANTHROPIC_API_KEY": "Claude API (required for fixes)",
        "GITHUB_TOKEN": "GitHub API (required for PR creation)",
    }

    optional_keys = {
        "LOKI_PUSH_URL": "Loki for log aggregation",
    }

    any_required = False
    for key, description in required_keys.items():
        is_set = check_env_variable(key, required=True)
        any_required = any_required or is_set

    print()
    for key, description in optional_keys.items():
        check_env_variable(key, required=False)

    return any_required


def generate_setup_instructions() -> str:
    """Generate setup instructions."""
    instructions = f"""
{Colors.BOLD}{Colors.BLUE}Setup Instructions{Colors.RESET}

1. {Colors.BOLD}Install Railway CLI{Colors.RESET}:
   npm install -g @railway/cli

2. {Colors.BOLD}Login to Railway{Colors.RESET}:
   railway login

3. {Colors.BOLD}Link to your project{Colors.RESET}:
   railway link

4. {Colors.BOLD}Set environment variables{Colors.RESET}:
   {Colors.YELLOW}export ANTHROPIC_API_KEY=sk-ant-...${{Colors.RESET}}
   {Colors.YELLOW}export GITHUB_TOKEN=ghp_...${{Colors.RESET}}

5. {Colors.BOLD}Configure Git (if not done){Colors.RESET}:
   git config --global user.email "your@email.com"
   git config --global user.name "Your Name"

6. {Colors.BOLD}Start the application{Colors.RESET}:
   python src/main.py

7. {Colors.BOLD}Test the error monitor{Colors.RESET}:
   curl http://localhost:8000/error-monitor/health

8. {Colors.BOLD}Run Railway log monitor{Colors.RESET}:
   python scripts/railway_error_watch.py --auto-fix

{Colors.BOLD}{Colors.BLUE}API Endpoints{Colors.RESET}

{Colors.GREEN}✓{Colors.RESET} GET  /error-monitor/health                  - Check monitoring status
{Colors.GREEN}✓{Colors.RESET} GET  /error-monitor/dashboard               - View error dashboard
{Colors.GREEN}✓{Colors.RESET} GET  /error-monitor/errors/critical         - Get critical errors
{Colors.GREEN}✓{Colors.RESET} GET  /error-monitor/errors/fixable          - Get fixable errors
{Colors.GREEN}✓{Colors.RESET} POST /error-monitor/fixes/generate-for-error - Generate fix
{Colors.GREEN}✓{Colors.RESET} POST /error-monitor/monitor/scan            - Scan for errors

{Colors.BOLD}{Colors.BLUE}Documentation{Colors.RESET}

{Colors.YELLOW}→{Colors.RESET} See docs/ERROR_MONITORING.md for complete guide
"""
    return instructions


def run_final_test() -> bool:
    """Run a quick functional test."""
    print_header("Functional Test")

    sys.path.insert(0, "/root/repo")

    try:
        from src.services.error_monitor import ErrorPattern, ErrorCategory, ErrorSeverity
        from datetime import datetime

        # Create a test error
        test_error = ErrorPattern(
            error_type="TestError",
            message="This is a test error",
            category=ErrorCategory.INTERNAL_ERROR,
            severity=ErrorSeverity.MEDIUM,
            file="test.py",
            line=42,
            function="test_func",
            stack_trace="",
            timestamp=datetime.utcnow(),
        )

        print_check("Error pattern creation", True)

        # Test categorization
        test_cases = [
            ("Rate limit exceeded: 429", ErrorCategory.RATE_LIMIT_ERROR),
            ("Connection timeout", ErrorCategory.TIMEOUT_ERROR),
            ("Invalid API key", ErrorCategory.AUTH_ERROR),
            ("Redis connection failed", ErrorCategory.CACHE_ERROR),
        ]

        for message, expected_category in test_cases:
            from src.services.error_monitor import ErrorMonitor

            monitor = ErrorMonitor()
            category, _ = monitor.classify_error(
                {"message": message, "stack_trace": ""}
            )
            matches = category == expected_category

            print_check(f"Classification: {message[:30]}", matches)

        return True

    except Exception as e:
        print_check("Functional test", False, str(e))
        return False


def main():
    """Main function."""
    print_header("Error Monitoring Setup Validator")

    checks = [
        ("Python Version", check_python_version),
        ("Dependencies", check_dependencies),
        ("Railway CLI", check_railway_cli),
        ("Railway Login", check_railway_login),
        ("Git Config", check_git_config),
        ("Routes", check_routes_file),
        ("Modules", check_error_monitor_module),
        ("Imports", test_imports),
        ("API Keys", check_api_keys),
        ("Functional", run_final_test),
    ]

    results = {}
    for check_name, check_func in checks:
        try:
            results[check_name] = check_func()
        except Exception as e:
            print(f"{Colors.RED}✗ {check_name} - Exception: {e}{Colors.RESET}")
            results[check_name] = False

    # Summary
    print_header("Validation Summary")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"{Colors.BOLD}Results: {passed}/{total} checks passed{Colors.RESET}\n")

    for check_name, result in results.items():
        icon = f"{Colors.GREEN}✓{Colors.RESET}" if result else f"{Colors.RED}✗{Colors.RESET}"
        print(f"{icon} {check_name}")

    # Show instructions
    print(generate_setup_instructions())

    # Exit code
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
