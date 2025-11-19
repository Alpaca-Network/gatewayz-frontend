"""
Automated bug fix generator using Claude API.

Analyzes error patterns and generates fixes with explanations.
Integrates with git and GitHub for automated PR creation.
"""

import asyncio
import json
import logging
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx

from src.config.config import Config
from src.services.error_monitor import ErrorCategory, ErrorPattern

logger = logging.getLogger(__name__)


@dataclass
class BugFix:
    """Represents a generated bug fix."""

    id: str
    error_pattern_id: str
    error_message: str
    error_category: str
    analysis: str
    proposed_fix: str
    code_changes: Dict[str, str]  # file_path -> code
    files_affected: List[str]
    severity: str
    generated_at: datetime
    pr_url: Optional[str] = None
    status: str = "pending"  # pending, testing, merged, failed

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "error_pattern_id": self.error_pattern_id,
            "error_message": self.error_message,
            "error_category": self.error_category,
            "analysis": self.analysis,
            "proposed_fix": self.proposed_fix,
            "code_changes": self.code_changes,
            "files_affected": self.files_affected,
            "severity": self.severity,
            "generated_at": self.generated_at.isoformat(),
            "pr_url": self.pr_url,
            "status": self.status,
        }


class BugFixGenerator:
    """Generates bug fixes using Claude API."""

    def __init__(self, github_token: Optional[str] = None):
        self.anthropic_key = Config.ANTHROPIC_API_KEY
        self.github_token = github_token or Config.GITHUB_TOKEN
        self.anthropic_url = "https://api.anthropic.com/v1"
        self.session: Optional[httpx.AsyncClient] = None
        self.generated_fixes: Dict[str, BugFix] = {}

    async def initialize(self):
        """Initialize the generator."""
        self.session = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close the generator."""
        if self.session:
            await self.session.aclose()

    async def analyze_error(self, error: ErrorPattern) -> str:
        """Use Claude to analyze an error and determine root cause."""
        if not self.session:
            await self.initialize()

        prompt = f"""You are an expert Python developer and DevOps engineer. Analyze this error and determine the root cause.

Error Type: {error.error_type}
Message: {error.message}
Category: {error.category.value}
Severity: {error.severity.value}
File: {error.file or 'unknown'}
Line: {error.line or 'unknown'}
Function: {error.function or 'unknown'}

Stack Trace:
{error.stack_trace or 'Not provided'}

Error Count: {error.count}
Last Seen: {error.last_seen}

Provide a concise analysis of:
1. Root cause
2. Impact
3. Why this is happening
4. Which component is affected"""

        try:
            response = await self.session.post(
                f"{self.anthropic_url}/messages",
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-opus-4-1-20250805",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()

            if data.get("content"):
                return data["content"][0].get("text", "Analysis failed")
            return "Analysis failed"

        except Exception as e:
            logger.error(f"Error analyzing with Claude: {e}")
            return f"Error analysis failed: {str(e)}"

    async def generate_fix(self, error: ErrorPattern) -> Optional[BugFix]:
        """Generate a fix for the error using Claude."""
        if not self.session:
            await self.initialize()

        # First, analyze the error
        analysis = await self.analyze_error(error)

        # Then generate a fix
        fix_prompt = f"""Based on this error analysis, generate a specific fix.

Error: {error.message}
Category: {error.category.value}
File: {error.file or 'unknown'}

Analysis:
{analysis}

Generate a fix that includes:
1. Root cause fix
2. Specific code changes needed
3. File paths to modify
4. Prevention measures

Format your response as JSON:
{{
  "title": "Brief title for the fix",
  "description": "What the fix does",
  "explanation": "Why this fixes the issue",
  "changes": [
    {{
      "file": "path/to/file.py",
      "type": "modify|add|delete",
      "change_description": "What changed",
      "code": "The actual code to add/modify (if modify, include surrounding context)"
    }}
  ]
}}"""

        try:
            response = await self.session.post(
                f"{self.anthropic_url}/messages",
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-opus-4-1-20250805",
                    "max_tokens": 2048,
                    "messages": [{"role": "user", "content": fix_prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("content"):
                logger.error("No content in Claude response")
                return None

            response_text = data["content"][0].get("text", "")

            # Extract JSON from response
            try:
                # Find JSON in the response
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    fix_data = json.loads(response_text[json_start:json_end])
                else:
                    logger.error("No JSON found in Claude response")
                    return None
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Claude response as JSON: {e}")
                return None

            # Create code changes mapping
            code_changes = {}
            files_affected = []

            for change in fix_data.get("changes", []):
                file_path = change.get("file")
                if file_path:
                    code_changes[file_path] = change.get("code", "")
                    files_affected.append(file_path)

            fix = BugFix(
                id=str(uuid4()),
                error_pattern_id=f"{error.category.value}:{error.message[:50]}",
                error_message=error.message,
                error_category=error.category.value,
                analysis=analysis,
                proposed_fix=fix_data.get("description", ""),
                code_changes=code_changes,
                files_affected=files_affected,
                severity=error.severity.value,
                generated_at=datetime.utcnow(),
            )

            self.generated_fixes[fix.id] = fix
            return fix

        except Exception as e:
            logger.error(f"Error generating fix with Claude: {e}")
            return None

    async def create_branch_and_commit(
        self, fix: BugFix, repo_path: str = "/root/repo"
    ) -> Optional[str]:
        """Create a git branch and commit the fix."""
        try:
            branch_name = f"auto-fix/{fix.error_category}/{uuid4().hex[:8]}"

            # Create branch
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=repo_path,
                check=True,
                capture_output=True,
            )

            # Apply changes
            for file_path, code in fix.code_changes.items():
                full_path = f"{repo_path}/{file_path}"

                # Create directory if needed
                import os

                os.makedirs(os.path.dirname(full_path), exist_ok=True)

                with open(full_path, "w") as f:
                    f.write(code)

                # Stage file
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=repo_path,
                    check=True,
                    capture_output=True,
                )

            # Commit
            commit_message = f"""fix: {fix.error_category} - Auto-generated fix

Error: {fix.error_message}
Severity: {fix.severity}

Analysis:
{fix.analysis}

Fix Description:
{fix.proposed_fix}

Files Modified:
{chr(10).join(f'- {f}' for f in fix.files_affected)}

Generated by Error Monitor Auto-Fix System
🤖 Generated with Claude API
"""

            subprocess.run(
                ["git", "commit", "-m", commit_message],
                cwd=repo_path,
                check=True,
                capture_output=True,
            )

            return branch_name

        except subprocess.CalledProcessError as e:
            logger.error(f"Git error: {e.stderr.decode()}")
            return None
        except Exception as e:
            logger.error(f"Error creating branch: {e}")
            return None

    async def create_pull_request(
        self,
        fix: BugFix,
        branch_name: str,
        repo: str = "terragon-labs/gatewayz",
        base_branch: str = "main",
    ) -> Optional[str]:
        """Create a GitHub PR for the fix."""
        if not self.github_token:
            logger.warning("GitHub token not configured, skipping PR creation")
            return None

        try:
            # Create PR via GitHub API
            pr_data = {
                "title": f"[AUTO] Fix {fix.error_category}: {fix.error_message[:50]}",
                "body": f"""## Auto-Generated Bug Fix

**Error Category**: {fix.error_category}
**Severity**: {fix.severity}
**Error Count**: {fix.error_pattern_id}

### Analysis
{fix.analysis}

### Proposed Fix
{fix.proposed_fix}

### Files Modified
{chr(10).join(f'- `{f}`' for f in fix.files_affected)}

### Details
- **Generated**: {fix.generated_at.isoformat()}
- **Fix ID**: {fix.id}
- **Status**: Awaiting Review

> 🤖 This PR was automatically generated by the Error Monitor system using Claude API analysis.
> Please review carefully before merging.
""",
                "head": branch_name,
                "base": base_branch,
            }

            response = await self.session.post(
                f"https://api.github.com/repos/{repo}/pulls",
                headers={
                    "Authorization": f"token {self.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json=pr_data,
            )

            if response.status_code in [201, 200]:
                pr_json = response.json()
                pr_url = pr_json.get("html_url")
                fix.pr_url = pr_url
                fix.status = "testing"
                logger.info(f"Created PR: {pr_url}")
                return pr_url
            else:
                logger.error(f"Failed to create PR: {response.text}")
                return None

        except Exception as e:
            logger.error(f"Error creating PR: {e}")
            return None

    async def process_error(self, error: ErrorPattern, create_pr: bool = True) -> Optional[BugFix]:
        """Process an error end-to-end: analyze, fix, commit, and create PR."""
        try:
            logger.info(f"Processing error: {error.message}")

            # Generate fix
            fix = await self.generate_fix(error)
            if not fix:
                logger.error("Failed to generate fix")
                return None

            logger.info(f"Generated fix: {fix.id}")

            # Create branch and commit
            if fix.code_changes:
                branch_name = await self.create_branch_and_commit(fix)
                if not branch_name:
                    logger.error("Failed to create branch")
                    fix.status = "failed"
                    return fix

                logger.info(f"Created branch: {branch_name}")

                # Create PR if requested
                if create_pr:
                    pr_url = await self.create_pull_request(fix, branch_name)
                    if pr_url:
                        logger.info(f"Created PR: {pr_url}")
                    else:
                        logger.warning("Failed to create PR")

            return fix

        except Exception as e:
            logger.error(f"Error processing error: {e}", exc_info=True)
            return None

    async def process_multiple_errors(
        self, errors: List[ErrorPattern], create_prs: bool = True
    ) -> List[BugFix]:
        """Process multiple errors in parallel."""
        tasks = [self.process_error(error, create_pr=create_prs) for error in errors]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        fixes = []
        for result in results:
            if isinstance(result, BugFix):
                fixes.append(result)
            elif isinstance(result, Exception):
                logger.error(f"Error processing error: {result}")

        return fixes


# Singleton instance
_bug_fix_generator: Optional[BugFixGenerator] = None


async def get_bug_fix_generator() -> BugFixGenerator:
    """Get or create the bug fix generator singleton."""
    global _bug_fix_generator
    if _bug_fix_generator is None:
        _bug_fix_generator = BugFixGenerator()
        await _bug_fix_generator.initialize()
    return _bug_fix_generator
