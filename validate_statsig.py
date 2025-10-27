#!/usr/bin/env python3
"""
Statsig Configuration Validation Script
========================================

This script validates that Statsig is properly configured in the codebase.
It checks:
1. Service implementation exists
2. Routes are configured
3. Environment variables are documented
4. Integration points are correct
"""

import os
import sys


def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def print_check(message, status, details=None):
    """Print a check result"""
    icon = "✅" if status else "❌"
    print(f"{icon} {message}")
    if details:
        for detail in details:
            print(f"   {detail}")


def validate_statsig_configuration():
    """Main validation function"""

    print_header("STATSIG CONFIGURATION VALIDATION")

    all_checks_passed = True

    # Check 1: Service Implementation
    print("\n[CHECK 1] Service Implementation")
    try:
        service_file = "src/services/statsig_service.py"
        if os.path.exists(service_file):
            with open(service_file, 'r') as f:
                content = f.read()

            has_class = 'class StatsigService' in content
            has_initialize = 'async def initialize' in content
            has_log_event = 'def log_event' in content
            has_shutdown = 'async def shutdown' in content
            has_statsig_import = 'from statsig_python_core import' in content

            checks = [
                ("StatsigService class exists", has_class),
                ("initialize() method exists", has_initialize),
                ("log_event() method exists", has_log_event),
                ("shutdown() method exists", has_shutdown),
                ("Statsig SDK import present", has_statsig_import),
            ]

            for check_name, check_result in checks:
                print_check(check_name, check_result)
                if not check_result:
                    all_checks_passed = False

        else:
            print_check("Service file exists", False, [f"File not found: {service_file}"])
            all_checks_passed = False

    except Exception as e:
        print_check("Service implementation check", False, [str(e)])
        all_checks_passed = False

    # Check 2: Analytics Routes
    print("\n[CHECK 2] Analytics Routes")
    try:
        routes_file = "src/routes/analytics.py"
        if os.path.exists(routes_file):
            with open(routes_file, 'r') as f:
                content = f.read()

            has_router = 'router = APIRouter' in content
            has_events_endpoint = '@router.post("/events")' in content
            has_batch_endpoint = '@router.post("/batch")' in content
            has_statsig_import = 'from src.services.statsig_service import statsig_service' in content

            checks = [
                ("APIRouter configured", has_router),
                ("POST /events endpoint exists", has_events_endpoint),
                ("POST /batch endpoint exists", has_batch_endpoint),
                ("Statsig service imported", has_statsig_import),
            ]

            for check_name, check_result in checks:
                print_check(check_name, check_result)
                if not check_result:
                    all_checks_passed = False

        else:
            print_check("Routes file exists", False, [f"File not found: {routes_file}"])
            all_checks_passed = False

    except Exception as e:
        print_check("Routes check", False, [str(e)])
        all_checks_passed = False

    # Check 3: Main App Integration
    print("\n[CHECK 3] Main App Integration")
    try:
        main_file = "src/main.py"
        if os.path.exists(main_file):
            with open(main_file, 'r') as f:
                content = f.read()

            has_analytics_route = '"analytics"' in content or "'analytics'" in content
            has_statsig_init = 'await statsig_service.initialize()' in content
            has_statsig_shutdown = 'await statsig_service.shutdown()' in content

            checks = [
                ("Analytics routes loaded", has_analytics_route),
                ("Statsig initialized on startup", has_statsig_init),
                ("Statsig shutdown on app close", has_statsig_shutdown),
            ]

            for check_name, check_result in checks:
                print_check(check_name, check_result)
                if not check_result:
                    all_checks_passed = False

        else:
            print_check("Main file exists", False, [f"File not found: {main_file}"])
            all_checks_passed = False

    except Exception as e:
        print_check("Main app integration check", False, [str(e)])
        all_checks_passed = False

    # Check 4: Environment Configuration
    print("\n[CHECK 4] Environment Configuration")
    try:
        env_example_file = ".env.example"
        if os.path.exists(env_example_file):
            with open(env_example_file, 'r') as f:
                content = f.read()

            has_statsig_key = 'STATSIG_SERVER_SECRET_KEY' in content

            print_check("STATSIG_SERVER_SECRET_KEY in .env.example", has_statsig_key)
            if not has_statsig_key:
                all_checks_passed = False

            # Check if actual .env file exists
            env_file = ".env"
            if os.path.exists(env_file):
                print_check(".env file exists", True)
                with open(env_file, 'r') as f:
                    env_content = f.read()
                    has_actual_key = 'STATSIG_SERVER_SECRET_KEY=' in env_content and \
                                   'secret-your-server-secret-key' not in env_content

                    if has_actual_key:
                        print_check("STATSIG_SERVER_SECRET_KEY configured in .env", True,
                                  ["Key is set (value hidden for security)"])
                    else:
                        print_check("STATSIG_SERVER_SECRET_KEY configured in .env", False,
                                  ["Key not set or using placeholder value"])
            else:
                print_check(".env file exists", False,
                          ["Create .env file based on .env.example"])

        else:
            print_check("Environment example file exists", False,
                      [f"File not found: {env_example_file}"])
            all_checks_passed = False

    except Exception as e:
        print_check("Environment configuration check", False, [str(e)])
        all_checks_passed = False

    # Check 5: Requirements
    print("\n[CHECK 5] Python Dependencies")
    try:
        requirements_file = "requirements.txt"
        if os.path.exists(requirements_file):
            with open(requirements_file, 'r') as f:
                content = f.read()

            has_statsig_package = 'statsig-python-core' in content

            print_check("statsig-python-core in requirements.txt", has_statsig_package)
            if has_statsig_package:
                # Extract version
                for line in content.split('\n'):
                    if 'statsig-python-core' in line:
                        print(f"   Version: {line.strip()}")
            else:
                all_checks_passed = False

            # Try to import statsig (note: package is statsig-python-core, import is statsig_python_core)
            try:
                from statsig_python_core import Statsig, StatsigUser, StatsigOptions
                print_check("statsig SDK installed and importable", True,
                          ["Successfully imported: Statsig, StatsigUser, StatsigOptions"])
            except ImportError:
                print_check("statsig SDK installed and importable", False,
                          ["Run: pip install statsig-python-core==0.10.2",
                           "Note: Package is 'statsig-python-core' but import uses 'statsig_python_core'"])

        else:
            print_check("Requirements file exists", False,
                      [f"File not found: {requirements_file}"])
            all_checks_passed = False

    except Exception as e:
        print_check("Requirements check", False, [str(e)])
        all_checks_passed = False

    # Summary
    print_header("VALIDATION SUMMARY")

    if all_checks_passed:
        print("\n✅ All configuration checks passed!")
        print("\nStatsig is properly configured in the codebase.")
    else:
        print("\n⚠️  Some configuration checks failed.")
        print("\nPlease review the issues above and fix them.")

    print("\n" + "=" * 60)
    print("NEXT STEPS TO ENABLE STATSIG")
    print("=" * 60)
    print("\n1. Install dependencies:")
    print("   pip install -r requirements.txt")
    print("\n2. Set up environment variables:")
    print("   - Copy .env.example to .env")
    print("   - Get your server secret key from:")
    print("     https://console.statsig.com -> Project Settings -> API Keys")
    print("   - Add to .env: STATSIG_SERVER_SECRET_KEY=secret-YOUR-KEY-HERE")
    print("\n3. Start/restart the backend server:")
    print("   python src/main.py")
    print("\n4. Test event logging:")
    print("   - Make requests to POST /v1/analytics/events")
    print("   - Check Statsig console for events:")
    print("     https://console.statsig.com/events")
    print("\n5. Monitor logs for Statsig initialization:")
    print("   - Look for: ✅ Statsig SDK initialized successfully")
    print("   - Or warning: ⚠️  STATSIG_SERVER_SECRET_KEY not set")

    print("\n" + "=" * 60)

    return all_checks_passed


if __name__ == "__main__":
    success = validate_statsig_configuration()
    sys.exit(0 if success else 1)
