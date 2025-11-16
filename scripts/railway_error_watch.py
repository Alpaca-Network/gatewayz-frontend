#!/usr/bin/env python3
"""
Railway CLI Error Monitor

Continuously monitors Railway logs for errors and triggers automated fixes.
Usage: python scripts/railway_error_watch.py [--service SERVICE] [--auto-fix] [--interval SECONDS]
"""

import argparse
import asyncio
import json
import logging
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.error_monitor import ErrorMonitor, ErrorPattern
from src.services.bug_fix_generator import BugFixGenerator
from src.config.logging_config import configure_logging

# Configure logging
configure_logging()
logger = logging.getLogger(__name__)


class RailwayLogMonitor:
    """Monitors Railway logs using the Railway CLI."""

    def __init__(self, service: str = None, auto_fix: bool = False, interval: int = 60):
        """
        Initialize the monitor.

        Args:
            service: Specific service to monitor (optional)
            auto_fix: Automatically generate and commit fixes
            interval: Polling interval in seconds
        """
        self.service = service
        self.auto_fix = auto_fix
        self.interval = interval
        self.error_monitor = ErrorMonitor()
        self.bug_fix_generator = BugFixGenerator() if auto_fix else None
        self.last_log_time = datetime.utcnow() - timedelta(hours=1)
        self.processed_errors = set()

    async def initialize(self):
        """Initialize services."""
        await self.error_monitor.initialize()
        if self.bug_fix_generator:
            await self.bug_fix_generator.initialize()

    async def close(self):
        """Close services."""
        await self.error_monitor.close()
        if self.bug_fix_generator:
            await self.bug_fix_generator.close()

    def check_railway_installed(self) -> bool:
        """Check if Railway CLI is installed."""
        try:
            result = subprocess.run(
                ["railway", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except FileNotFoundError:
            logger.error("Railway CLI not found. Install it with: npm install -g @railway/cli")
            return False

    def fetch_railway_logs(self, lines: int = 100) -> str:
        """Fetch logs from Railway."""
        try:
            cmd = ["railway", "logs", "--tail", str(lines)]

            if self.service:
                cmd.extend(["--service", self.service])

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                return result.stdout
            else:
                logger.error(f"Railway CLI error: {result.stderr}")
                return ""

        except subprocess.TimeoutExpired:
            logger.error("Railway logs command timed out")
            return ""
        except Exception as e:
            logger.error(f"Error fetching Railway logs: {e}")
            return ""

    def parse_railway_logs(self, logs: str) -> list:
        """Parse Railway logs into structured events."""
        events = []

        for line in logs.split("\n"):
            if not line.strip():
                continue

            # Try to extract error indicators
            if any(
                indicator in line.lower()
                for indicator in [
                    "error",
                    "exception",
                    "traceback",
                    "failed",
                    "fatal",
                    "critical",
                ]
            ):
                # Try to parse as JSON if available
                try:
                    # Railway logs may have JSON embedded
                    json_match = re.search(r"\{.*\}", line)
                    if json_match:
                        event = json.loads(json_match.group())
                    else:
                        event = {
                            "message": line,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                except json.JSONDecodeError:
                    event = {
                        "message": line,
                        "timestamp": datetime.utcnow().isoformat(),
                    }

                events.append(event)

        return events

    async def process_logs(self):
        """Process Railway logs and detect errors."""
        logger.info("Fetching Railway logs...")
        logs = self.fetch_railway_logs(lines=100)

        if not logs:
            logger.warning("No logs retrieved from Railway")
            return

        # Parse logs
        events = self.parse_railway_logs(logs)

        if not events:
            logger.debug("No errors found in current logs")
            return

        logger.info(f"Found {len(events)} potential error events")

        # Analyze errors
        patterns = await self.error_monitor.analyze_errors(events)

        if not patterns:
            logger.debug("No error patterns detected")
            return

        logger.info(f"Detected {len(patterns)} error patterns")

        # Filter to new errors
        new_patterns = []
        for pattern in patterns:
            error_key = f"{pattern.category.value}:{pattern.message[:50]}"
            if error_key not in self.processed_errors:
                new_patterns.append(pattern)
                self.processed_errors.add(error_key)

        if not new_patterns:
            logger.debug("All errors have been processed")
            return

        # Store patterns
        for pattern in new_patterns:
            self.error_monitor.store_error_pattern(pattern)
            logger.warning(
                f"[{pattern.severity.value.upper()}] {pattern.category.value}: "
                f"{pattern.message[:100]}"
            )

            # Auto-fix if enabled
            if self.auto_fix and pattern.fixable and self.bug_fix_generator:
                logger.info(f"Generating auto-fix for: {pattern.message[:50]}")
                try:
                    fix = await self.bug_fix_generator.process_error(
                        pattern, create_pr=True
                    )
                    if fix:
                        logger.info(f"Generated fix: {fix.id}")
                        if fix.pr_url:
                            logger.info(f"Created PR: {fix.pr_url}")
                except Exception as e:
                    logger.error(f"Error generating fix: {e}")

    async def run(self):
        """Run continuous monitoring."""
        await self.initialize()

        try:
            logger.info("Starting Railway error monitor...")
            logger.info(f"Service: {self.service or 'all'}")
            logger.info(f"Auto-fix: {self.auto_fix}")
            logger.info(f"Interval: {self.interval}s")

            if not self.check_railway_installed():
                logger.error("Cannot proceed without Railway CLI")
                return

            while True:
                try:
                    await self.process_logs()
                except Exception as e:
                    logger.error(f"Error during monitoring cycle: {e}", exc_info=True)

                logger.debug(f"Waiting {self.interval}s for next check...")
                await asyncio.sleep(self.interval)

        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)
        finally:
            await self.close()

    def print_status(self):
        """Print current monitoring status."""
        print("\n" + "=" * 60)
        print("Railway Error Monitor Status")
        print("=" * 60)
        print(f"Timestamp:          {datetime.utcnow().isoformat()}")
        print(f"Service:            {self.service or 'all'}")
        print(f"Auto-fix Enabled:   {self.auto_fix}")
        print(f"Check Interval:     {self.interval}s")
        print(f"Errors Tracked:     {len(self.error_monitor.error_patterns)}")
        print(f"Errors Processed:   {len(self.processed_errors)}")

        if self.error_monitor.error_patterns:
            print("\nRecent Error Patterns:")
            for i, (key, pattern) in enumerate(
                list(self.error_monitor.error_patterns.items())[-5:], 1
            ):
                print(
                    f"  {i}. [{pattern.severity.value}] "
                    f"{pattern.category.value}: "
                    f"{pattern.message[:60]}"
                )

        print("=" * 60 + "\n")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Monitor Railway logs for errors and generate fixes"
    )
    parser.add_argument(
        "--service",
        type=str,
        default=None,
        help="Specific service to monitor",
    )
    parser.add_argument(
        "--auto-fix",
        action="store_true",
        help="Automatically generate and commit fixes for errors",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Check interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log level (default: INFO)",
    )

    args = parser.parse_args()

    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    # Run monitor
    monitor = RailwayLogMonitor(
        service=args.service,
        auto_fix=args.auto_fix,
        interval=args.interval,
    )

    # Print initial status
    monitor.print_status()

    # Run
    await monitor.run()


if __name__ == "__main__":
    asyncio.run(main())
