#!/usr/bin/env python3
"""
Auto-Merge Setup Validation Script

This script validates that auto-merge and branch protection are properly
configured in your GitHub repository.

Usage: python scripts/validate_auto_merge_setup.py <owner> <repo>
"""

import subprocess
import sys
import json
from typing import Optional, Dict, Any

# Color codes for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color


def print_colored(text: str, color: str) -> None:
    """Print text with color."""
    print(f"{color}{text}{NC}")


def run_command(cmd: str) -> Optional[str]:
    """Run a shell command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=10
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, Exception):
        return None


def check_gh_cli() -> bool:
    """Check if GitHub CLI is installed."""
    return run_command("which gh") is not None


def get_current_repo() -> Optional[tuple[str, str]]:
    """Get owner and repo from current git repository."""
    try:
        url = run_command("git config --get remote.origin.url")
        if not url:
            return None

        # Parse owner/repo from URL
        if "github.com" in url:
            parts = url.split("/")
            owner = parts[-2]
            repo = parts[-1].replace(".git", "")
            return owner, repo
    except Exception:
        pass

    return None


def get_github_user() -> Optional[str]:
    """Get current GitHub user."""
    return run_command("gh api user --jq '.login'")


def check_auto_merge_enabled(owner: str, repo: str) -> Optional[bool]:
    """Check if auto-merge is enabled on repository."""
    result = run_command(
        f"gh api repos/{owner}/{repo} --jq '.allow_auto_merge'"
    )
    return result == "true" if result else None


def check_workflow_file(path: str) -> bool:
    """Check if workflow file exists."""
    import os
    return os.path.isfile(path)


def get_branch_protection(owner: str, repo: str, branch: str) -> Optional[Dict]:
    """Get branch protection settings."""
    cmd = f"gh api repos/{owner}/{repo}/branches/{branch}/protection"
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None


def main() -> int:
    """Main validation function."""
    # Get owner and repo
    if len(sys.argv) == 3:
        owner, repo = sys.argv[1], sys.argv[2]
    else:
        repo_info = get_current_repo()
        if not repo_info:
            print_colored(
                "❌ Not in a git repository and no owner/repo provided",
                RED
            )
            print("Usage: python scripts/validate_auto_merge_setup.py <owner> <repo>")
            return 1
        owner, repo = repo_info

    # Print header
    print_colored(
        "═" * 63,
        BLUE
    )
    print_colored("Auto-Merge & Branch Protection Validation", BLUE)
    print_colored(f"Repository: {owner}/{repo}", BLUE)
    print_colored("═" * 63, BLUE)
    print()

    # Test 1: Check GitHub CLI
    print_colored("[1/6] Checking GitHub CLI authentication...", YELLOW)
    if not check_gh_cli():
        print_colored("❌ GitHub CLI (gh) is not installed", RED)
        print("Install from: https://cli.github.com/")
        return 1

    user = get_github_user()
    if user:
        print_colored(f"✅ Authenticated as {user}", GREEN)
    else:
        print_colored("❌ Not authenticated with GitHub CLI", RED)
        print("Run: gh auth login")
        return 1
    print()

    # Test 2: Check auto-merge enabled
    print_colored("[2/6] Checking if auto-merge is enabled...", YELLOW)
    auto_merge = check_auto_merge_enabled(owner, repo)
    if auto_merge is True:
        print_colored("✅ Auto-merge is enabled", GREEN)
    elif auto_merge is False:
        print_colored("❌ Auto-merge is disabled", RED)
        print("   Enable it: Go to Settings → Pull requests → Allow auto merge")
    else:
        print_colored("⚠️  Could not determine auto-merge status", YELLOW)
    print()

    # Test 3: Check workflow files
    print_colored("[3/6] Checking for auto-merge workflow file...", YELLOW)
    if check_workflow_file(".github/workflows/auto-merge.yml"):
        print_colored("✅ auto-merge.yml workflow exists", GREEN)
    else:
        print_colored("❌ auto-merge.yml workflow not found", RED)
    print()

    # Test 4: Check CI workflow files
    print_colored("[4/6] Checking CI workflow files...", YELLOW)
    workflows_found = 0
    if check_workflow_file(".github/workflows/ci.yml"):
        print_colored("✅ ci.yml exists", GREEN)
        workflows_found += 1
    if check_workflow_file(".github/workflows/test.yml"):
        print_colored("✅ test.yml exists", GREEN)
        workflows_found += 1
    if workflows_found == 0:
        print_colored("⚠️  No CI workflows found", YELLOW)
    print()

    # Test 5: Check branch protection for main
    print_colored("[5/6] Checking branch protection rules for 'main'...", YELLOW)
    protection = get_branch_protection(owner, repo, "main")

    if protection:
        print_colored("✅ Branch protection is enabled for 'main'", GREEN)

        # Check specific settings
        if protection.get("required_pull_request_reviews"):
            print_colored("   ✓ Requires pull request reviews", GREEN)
        else:
            print_colored("   ⚠️  PR reviews not required", YELLOW)

        if protection.get("required_status_checks"):
            checks = protection["required_status_checks"]
            strict = checks.get("strict", False)
            contexts = len(checks.get("contexts", []))
            print_colored(
                f"   ✓ Requires status checks (strict: {strict})",
                GREEN
            )
            print_colored(f"   ✓ Number of required checks: {contexts}", GREEN)
        else:
            print_colored("   ⚠️  Status checks not required", YELLOW)

        if protection.get("allow_auto_merge"):
            print_colored("   ✓ Auto-merge allowed", GREEN)
        else:
            print_colored("   ✗ Auto-merge not allowed in branch protection", RED)
    else:
        print_colored("⚠️  No branch protection rule found for 'main'", YELLOW)
        print("   Create one: Go to Settings → Branches → Add rule")
    print()

    # Test 6: Check documentation
    print_colored("[6/6] Checking documentation files...", YELLOW)
    docs_found = 0
    if check_workflow_file("docs/AUTO_MERGE_IMPLEMENTATION.md"):
        print_colored("✅ AUTO_MERGE_IMPLEMENTATION.md exists", GREEN)
        docs_found += 1
    if check_workflow_file("docs/BRANCH_PROTECTION_SETUP.md"):
        print_colored("✅ BRANCH_PROTECTION_SETUP.md exists", GREEN)
        docs_found += 1
    if docs_found == 0:
        print_colored("⚠️  Documentation files not found", YELLOW)
    print()

    # Print summary
    print_colored("═" * 63, BLUE)
    print_colored("Setup Summary", BLUE)
    print_colored("═" * 63, BLUE)
    print()
    print(f"Repository: {owner}/{repo}")
    print(f"Auto-merge enabled: {auto_merge}")
    print(f"Branch protection (main): {'Yes' if protection else 'No'}")
    print()

    print_colored("Next Steps:", GREEN)
    print("1. Ensure branch protection is configured for your main branch")
    print("2. Set required status checks in branch protection rules")
    print("3. Enable 'Allow auto merge' in branch protection")
    print("4. Create a test PR to verify auto-merge workflow")
    print()

    print_colored("For detailed setup instructions, see:", BLUE)
    print("docs/BRANCH_PROTECTION_SETUP.md")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
