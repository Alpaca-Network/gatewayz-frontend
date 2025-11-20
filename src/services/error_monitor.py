"""
Error monitoring and detection service.

Monitors application logs for errors, classifies them, and triggers automated fixes.
Integrates with Loki/Grafana for log aggregation and Railway for deployment logs.
"""

import asyncio
import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx

from src.config.config import Config

logger = logging.getLogger(__name__)


class ErrorSeverity(str, Enum):
    """Error severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ErrorCategory(str, Enum):
    """Error categories for classification."""

    PROVIDER_ERROR = "provider_error"  # OpenRouter, Featherless, etc.
    DATABASE_ERROR = "database_error"  # Supabase connectivity
    RATE_LIMIT_ERROR = "rate_limit_error"  # Rate limiting issues
    AUTH_ERROR = "auth_error"  # Authentication failures
    TIMEOUT_ERROR = "timeout_error"  # Request timeouts
    VALIDATION_ERROR = "validation_error"  # Input validation
    CACHE_ERROR = "cache_error"  # Redis/cache issues
    EXTERNAL_SERVICE_ERROR = "external_service_error"  # Stripe, Resend, etc.
    INTERNAL_ERROR = "internal_error"  # Application logic errors
    UNKNOWN = "unknown"


@dataclass
class ErrorPattern:
    """Represents an error pattern detected in logs."""

    error_type: str
    message: str
    category: ErrorCategory
    severity: ErrorSeverity
    file: Optional[str]
    line: Optional[int]
    function: Optional[str]
    stack_trace: Optional[str]
    timestamp: datetime
    count: int = 1
    last_seen: Optional[datetime] = None
    examples: List[str] = None
    fixable: bool = False
    suggested_fix: Optional[str] = None

    def __post_init__(self):
        if self.examples is None:
            self.examples = []
        if self.last_seen is None:
            self.last_seen = self.timestamp

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        data["last_seen"] = self.last_seen.isoformat() if self.last_seen else None
        data["category"] = self.category.value
        data["severity"] = self.severity.value
        return data


class ErrorMonitor:
    """Monitors application errors from logs."""

    def __init__(self):
        self.session: Optional[httpx.AsyncClient] = None
        self.error_patterns: Dict[str, ErrorPattern] = {}
        self.loki_enabled = Config.LOKI_ENABLED
        self.loki_url = Config.LOKI_PUSH_URL

    async def __aenter__(self):
        self.session = httpx.AsyncClient(timeout=10.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()

    async def initialize(self):
        """Initialize the error monitor."""
        self.session = httpx.AsyncClient(timeout=10.0)

    async def close(self):
        """Close the error monitor."""
        if self.session:
            await self.session.aclose()

    async def fetch_recent_errors(self, hours: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch recent errors from Loki.

        Args:
            hours: Look back this many hours
            limit: Maximum number of errors to fetch

        Returns:
            List of error log entries
        """
        if not self.loki_enabled or not self.loki_url or not self.session:
            logger.warning("Loki not enabled or not initialized")
            return []

        try:
            # LogQL query to find error level logs
            query = '{level="ERROR"}'
            params = {
                "query": query,
                "limit": limit,
                "direction": "backward",
            }

            # Loki query API endpoint (typically /loki/api/v1/query_range)
            url = f"{self.loki_url.rstrip('/')}/loki/api/v1/query_range"

            response = await self.session.get(url, params=params)
            response.raise_for_status()

            data = response.json()
            errors = []

            if data.get("data", {}).get("result"):
                for result in data["data"]["result"]:
                    for timestamp, log_line in result.get("values", []):
                        try:
                            log_data = json.loads(log_line)
                            errors.append(log_data)
                        except json.JSONDecodeError:
                            # Raw log line
                            errors.append({"message": log_line, "timestamp": timestamp})

            return errors

        except Exception as e:
            logger.error(f"Error fetching from Loki: {e}")
            return []

    def classify_error(self, error_data: Dict[str, Any]) -> tuple[ErrorCategory, ErrorSeverity]:
        """
        Classify an error based on its content.

        Args:
            error_data: Error log data

        Returns:
            Tuple of (category, severity)
        """
        message = error_data.get("message", "").lower()
        stack_trace = error_data.get("stack_trace", "").lower()
        full_text = f"{message} {stack_trace}"

        # Provider errors
        if any(
            provider in full_text
            for provider in [
                "openrouter",
                "featherless",
                "deepinfra",
                "together",
                "huggingface",
                "vertexai",
            ]
        ):
            if "timeout" in full_text or "504" in full_text or "503" in full_text:
                return ErrorCategory.PROVIDER_ERROR, ErrorSeverity.HIGH
            if "401" in full_text or "403" in full_text:
                return ErrorCategory.AUTH_ERROR, ErrorSeverity.HIGH
            return ErrorCategory.PROVIDER_ERROR, ErrorSeverity.MEDIUM

        # Database errors
        if any(
            term in full_text for term in ["supabase", "postgresql", "database", "connection pool"]
        ):
            return ErrorCategory.DATABASE_ERROR, ErrorSeverity.CRITICAL

        # Rate limiting
        if "rate limit" in full_text or "429" in full_text:
            return ErrorCategory.RATE_LIMIT_ERROR, ErrorSeverity.MEDIUM

        # Authentication
        if any(term in full_text for term in ["unauthorized", "invalid api key", "401"]):
            return ErrorCategory.AUTH_ERROR, ErrorSeverity.HIGH

        # Timeouts
        if "timeout" in full_text or "deadlineexceeded" in full_text:
            return ErrorCategory.TIMEOUT_ERROR, ErrorSeverity.MEDIUM

        # Validation
        if "validation" in full_text or "invalid" in full_text:
            return ErrorCategory.VALIDATION_ERROR, ErrorSeverity.LOW

        # Cache/Redis
        if "redis" in full_text or "cache" in full_text:
            return ErrorCategory.CACHE_ERROR, ErrorSeverity.MEDIUM

        # External services
        if any(term in full_text for term in ["stripe", "resend", "email", "payment"]):
            return ErrorCategory.EXTERNAL_SERVICE_ERROR, ErrorSeverity.HIGH

        return ErrorCategory.INTERNAL_ERROR, ErrorSeverity.MEDIUM

    def extract_error_details(self, error_data: Dict[str, Any]) -> ErrorPattern:
        """Extract details from error log."""
        message = error_data.get("message", "Unknown error")
        stack_trace = error_data.get("stack_trace", "")
        timestamp = error_data.get("timestamp", datetime.utcnow())

        # Parse timestamp if it's a string
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                timestamp = datetime.utcnow()

        # Extract file, line, and function from stack trace
        file_match = re.search(r'File "([^"]+)", line (\d+)', stack_trace)
        func_match = re.search(r"in (\w+)", stack_trace)

        file_path = file_match.group(1) if file_match else None
        line_num = int(file_match.group(2)) if file_match else None
        function = func_match.group(1) if func_match else None

        category, severity = self.classify_error(error_data)

        # Generate pattern key for grouping similar errors
        pattern_key = f"{category.value}:{message[:50]}"

        return ErrorPattern(
            error_type=error_data.get("error_type", "Exception"),
            message=message,
            category=category,
            severity=severity,
            file=file_path,
            line=line_num,
            function=function,
            stack_trace=stack_trace,
            timestamp=timestamp,
            examples=[message],
        )

    def group_similar_errors(self, errors: List[ErrorPattern]) -> Dict[str, ErrorPattern]:
        """Group similar errors together."""
        grouped = {}

        for error in errors:
            # Create a pattern key based on category and message prefix
            pattern_key = f"{error.category.value}:{error.message[:50]}"

            if pattern_key in grouped:
                existing = grouped[pattern_key]
                existing.count += error.count
                existing.last_seen = max(existing.last_seen, error.timestamp)
                if error.message not in existing.examples:
                    existing.examples.append(error.message)
            else:
                grouped[pattern_key] = error

        return grouped

    def determine_fixability(self, error: ErrorPattern) -> tuple[bool, Optional[str]]:
        """Determine if an error is automatically fixable and suggest a fix."""
        category = error.category
        message = error.message.lower()

        # Rate limiting - suggest cache warmup or request throttling
        if category == ErrorCategory.RATE_LIMIT_ERROR:
            return True, "Implement exponential backoff and request queuing"

        # Timeout errors - suggest timeout increase or retry logic
        if category == ErrorCategory.TIMEOUT_ERROR:
            if "provider" in message:
                return True, "Add retry logic with exponential backoff for provider calls"
            return True, "Increase timeout threshold or add connection pooling"

        # Cache errors - suggest fallback mechanism
        if category == ErrorCategory.CACHE_ERROR:
            return True, "Implement cache fallback to database queries"

        # Database connection - suggest connection pool tuning
        if category == ErrorCategory.DATABASE_ERROR:
            if "connection pool" in message:
                return True, "Increase connection pool size or add connection pooling fallback"
            return True, "Add database connection retry logic"

        # Auth errors - suggest key rotation
        if category == ErrorCategory.AUTH_ERROR:
            if "invalid api key" in message:
                return True, "Rotate API keys and update configuration"
            return True, "Implement token refresh logic"

        return False, None

    async def analyze_errors(self, raw_errors: List[Dict[str, Any]]) -> List[ErrorPattern]:
        """Analyze raw errors and return structured error patterns."""
        error_patterns = []

        for raw_error in raw_errors:
            try:
                pattern = self.extract_error_details(raw_error)
                fixable, suggested_fix = self.determine_fixability(pattern)
                pattern.fixable = fixable
                pattern.suggested_fix = suggested_fix
                error_patterns.append(pattern)
            except Exception as e:
                logger.error(f"Error analyzing error pattern: {e}")

        # Group similar errors
        grouped = self.group_similar_errors(error_patterns)
        return list(grouped.values())

    async def get_critical_errors(self, hours: int = 1) -> List[ErrorPattern]:
        """Get critical errors from the last N hours."""
        raw_errors = await self.fetch_recent_errors(hours=hours)
        patterns = await self.analyze_errors(raw_errors)

        # Filter to critical and high severity
        critical = [
            p for p in patterns if p.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]
        ]

        return sorted(critical, key=lambda p: p.count, reverse=True)

    async def get_fixable_errors(self, hours: int = 1) -> List[ErrorPattern]:
        """Get errors that can be automatically fixed."""
        raw_errors = await self.fetch_recent_errors(hours=hours)
        patterns = await self.analyze_errors(raw_errors)

        fixable = [p for p in patterns if p.fixable]
        return sorted(fixable, key=lambda p: (p.severity.value, p.count), reverse=True)

    def store_error_pattern(self, pattern: ErrorPattern):
        """Store error pattern for tracking."""
        pattern_key = f"{pattern.category.value}:{pattern.message[:50]}"

        if pattern_key in self.error_patterns:
            existing = self.error_patterns[pattern_key]
            existing.count += pattern.count
            existing.last_seen = max(existing.last_seen, pattern.timestamp)
            existing.examples.extend(pattern.examples)
        else:
            self.error_patterns[pattern_key] = pattern

    async def monitor_continuously(self, interval: int = 300):
        """Monitor errors continuously at regular intervals."""
        await self.initialize()

        try:
            while True:
                try:
                    logger.info("Scanning for errors...")
                    critical_errors = await self.get_critical_errors(hours=1)

                    if critical_errors:
                        logger.warning(
                            f"Found {len(critical_errors)} critical errors: "
                            f"{[e.message for e in critical_errors]}"
                        )

                        for error in critical_errors:
                            self.store_error_pattern(error)

                    fixable_errors = await self.get_fixable_errors(hours=1)
                    if fixable_errors:
                        logger.info(
                            f"Found {len(fixable_errors)} fixable errors: "
                            f"{[e.message for e in fixable_errors]}"
                        )

                except Exception as e:
                    logger.error(f"Error during monitoring cycle: {e}", exc_info=True)

                await asyncio.sleep(interval)

        except KeyboardInterrupt:
            logger.info("Monitoring stopped")
        finally:
            await self.close()


# Singleton instance
_error_monitor: Optional[ErrorMonitor] = None


async def get_error_monitor() -> ErrorMonitor:
    """Get or create the error monitor singleton."""
    global _error_monitor
    if _error_monitor is None:
        _error_monitor = ErrorMonitor()
        await _error_monitor.initialize()
    return _error_monitor
