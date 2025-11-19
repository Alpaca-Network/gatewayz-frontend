"""
Autonomous error monitoring service.

Runs in the background as part of the FastAPI application startup/lifespan.
Monitors errors continuously and generates fixes without manual intervention.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from src.services.bug_fix_generator import BugFixGenerator, get_bug_fix_generator
from src.services.error_monitor import ErrorMonitor, get_error_monitor

logger = logging.getLogger(__name__)


class AutonomousMonitor:
    """Autonomous background error monitoring and fixing."""

    def __init__(
        self,
        enabled: bool = True,
        scan_interval: int = 300,  # 5 minutes
        auto_fix_enabled: bool = True,
        critical_error_threshold: int = 1,  # Create PR after N critical errors
        lookback_hours: int = 1,
    ):
        """
        Initialize autonomous monitor.

        Args:
            enabled: Enable autonomous monitoring
            scan_interval: Seconds between scans (default: 5 minutes)
            auto_fix_enabled: Automatically generate fixes
            critical_error_threshold: Min critical errors before creating PR
            lookback_hours: How many hours back to scan
        """
        self.enabled = enabled
        self.scan_interval = max(60, scan_interval)  # Minimum 1 minute
        self.auto_fix_enabled = auto_fix_enabled
        self.critical_error_threshold = critical_error_threshold
        self.lookback_hours = lookback_hours
        self.error_monitor: Optional[ErrorMonitor] = None
        self.bug_fix_generator: Optional[BugFixGenerator] = None
        self.is_running = False
        self.last_scan: Optional[datetime] = None
        self.errors_since_last_fix: int = 0
        self.task: Optional[asyncio.Task] = None

    async def initialize(self):
        """Initialize the monitor services."""
        if not self.enabled:
            logger.info("Autonomous monitoring is disabled")
            return

        try:
            logger.info("Initializing autonomous monitor...")
            self.error_monitor = await get_error_monitor()
            if self.auto_fix_enabled:
                self.bug_fix_generator = await get_bug_fix_generator()
            logger.info("✓ Autonomous monitor initialized")
        except Exception as e:
            logger.error(f"Failed to initialize autonomous monitor: {e}")
            self.enabled = False

    async def start(self):
        """Start the autonomous monitoring background task."""
        if not self.enabled:
            logger.warning("Autonomous monitoring is not enabled")
            return

        if self.is_running:
            logger.warning("Autonomous monitor already running")
            return

        logger.info(
            f"Starting autonomous error monitor (interval: {self.scan_interval}s, "
            f"auto-fix: {self.auto_fix_enabled})"
        )

        self.is_running = True
        self.task = asyncio.create_task(self._monitoring_loop())

    async def stop(self):
        """Stop the autonomous monitoring."""
        logger.info("Stopping autonomous monitor...")
        self.is_running = False

        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        logger.info("Autonomous monitor stopped")

    async def _monitoring_loop(self):
        """Main monitoring loop that runs in the background."""
        logger.info("Autonomous monitoring loop started")

        while self.is_running:
            try:
                self.last_scan = datetime.utcnow()
                logger.debug(f"Scanning for errors (lookback: {self.lookback_hours}h)")

                # Scan for errors
                await self._scan_for_errors()

                # Wait before next scan
                await asyncio.sleep(self.scan_interval)

            except asyncio.CancelledError:
                logger.info("Monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}", exc_info=True)
                # Continue despite errors
                await asyncio.sleep(self.scan_interval)

    async def _scan_for_errors(self):
        """Scan for errors and generate fixes if needed."""
        if not self.error_monitor:
            logger.warning("Error monitor not initialized")
            return

        try:
            # Get recent errors
            raw_errors = await self.error_monitor.fetch_recent_errors(
                hours=self.lookback_hours,
                limit=100,
            )

            if not raw_errors:
                logger.debug("No errors found in recent logs")
                return

            # Analyze errors
            patterns = await self.error_monitor.analyze_errors(raw_errors)

            if not patterns:
                logger.debug("No error patterns detected")
                return

            logger.info(f"Detected {len(patterns)} error patterns")

            # Store patterns
            for pattern in patterns:
                self.error_monitor.store_error_pattern(pattern)

            # Get critical errors
            critical = [p for p in patterns if p.severity.value in ["critical", "high"]]

            if critical:
                logger.warning(f"Found {len(critical)} critical/high errors")
                self.errors_since_last_fix += len(critical)

                # Generate fixes for critical errors if auto-fix is enabled
                if self.auto_fix_enabled and self.bug_fix_generator:
                    await self._generate_fixes_for_critical(critical)

        except Exception as e:
            logger.error(f"Error scanning for errors: {e}", exc_info=True)

    async def _generate_fixes_for_critical(self, critical_errors):
        """Generate fixes for critical errors."""
        if not self.bug_fix_generator:
            return

        try:
            # Filter to fixable errors
            fixable = [e for e in critical_errors if e.fixable]

            if not fixable:
                logger.debug(f"No fixable critical errors (out of {len(critical_errors)})")
                return

            logger.info(f"Generating fixes for {len(fixable)} critical errors")

            # Process errors
            fixes = await self.bug_fix_generator.process_multiple_errors(
                fixable,
                create_prs=True,
            )

            if fixes:
                logger.info(f"Generated {len(fixes)} fixes")
                self.errors_since_last_fix = 0  # Reset counter

                # Log fix details
                for fix in fixes:
                    logger.info(
                        f"Fix created: {fix.error_category} - {fix.error_message[:50]} "
                        f"(PR: {fix.pr_url or 'pending'})"
                    )
            else:
                logger.warning("No fixes were generated successfully")

        except Exception as e:
            logger.error(f"Error generating fixes: {e}", exc_info=True)

    async def get_status(self) -> dict:
        """Get current monitoring status."""
        return {
            "enabled": self.enabled,
            "running": self.is_running,
            "auto_fix_enabled": self.auto_fix_enabled,
            "scan_interval": self.scan_interval,
            "last_scan": self.last_scan.isoformat() if self.last_scan else None,
            "errors_since_last_fix": self.errors_since_last_fix,
            "total_patterns": (len(self.error_monitor.error_patterns) if self.error_monitor else 0),
        }


# Singleton instance
_autonomous_monitor: Optional[AutonomousMonitor] = None


def get_autonomous_monitor() -> AutonomousMonitor:
    """Get or create the autonomous monitor singleton."""
    global _autonomous_monitor
    if _autonomous_monitor is None:
        _autonomous_monitor = AutonomousMonitor()
    return _autonomous_monitor


async def initialize_autonomous_monitor(
    enabled: bool = True,
    scan_interval: int = 300,
    auto_fix_enabled: bool = True,
):
    """Initialize and start autonomous monitoring."""
    monitor = get_autonomous_monitor()

    # Update configuration
    monitor.enabled = enabled
    monitor.scan_interval = scan_interval
    monitor.auto_fix_enabled = auto_fix_enabled

    # Initialize
    await monitor.initialize()

    # Start monitoring
    if monitor.enabled:
        await monitor.start()

    return monitor
