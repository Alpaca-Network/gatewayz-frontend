#!/usr/bin/env python3
"""
Healthcheck Scheduler for Gateway Models

This script runs the model healthcheck on a regular schedule using APScheduler.
It can be configured to run at specific intervals and handles logging and error reporting.

Features:
- Scheduled execution of healthchecks
- Configurable intervals and timing
- Persistent logging to file and stdout
- Error handling and notifications
- Supports cron-style scheduling
- Health status tracking and history
"""

import sys
import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import atexit

from healthcheck_all_models import run_all_gateways_healthcheck

# Configure logging
log_dir = Path('logs')
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'healthcheck_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Results directory
results_dir = Path('healthcheck_results')
results_dir.mkdir(exist_ok=True)


class HealthcheckScheduler:
    """Manages scheduled healthchecks"""

    def __init__(self, config: Optional[dict] = None):
        """
        Initialize scheduler

        Args:
            config: Configuration dictionary with scheduling options
        """
        self.scheduler = BackgroundScheduler()
        self.config = config or self._load_default_config()
        self.last_run_timestamp = None
        self.last_run_results = None

        logger.info(f"Initialized HealthcheckScheduler with config: {self.config}")

    def _load_default_config(self) -> dict:
        """Load configuration from file or use defaults"""
        config_file = Path('healthcheck_config.json')

        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    config = json.load(f)
                logger.info(f"Loaded configuration from {config_file}")
                return config
            except Exception as e:
                logger.warning(f"Failed to load config file: {e}. Using defaults.")

        # Default configuration
        return {
            'schedule_type': 'interval',  # 'interval' or 'cron'
            'interval_minutes': 60,  # Run every 60 minutes
            'cron_expression': '0 * * * *',  # Run every hour (cron format)
            'export_json': True,
            'keep_history': True,
            'max_history_files': 168,  # Keep 7 days of hourly runs
            'notify_on_unhealthy': True,
            'notification_webhook': None,
        }

    def schedule_healthcheck(self):
        """Schedule the healthcheck job"""
        try:
            if self.config['schedule_type'] == 'cron':
                trigger = CronTrigger.from_crontab(self.config['cron_expression'])
                logger.info(f"Scheduling with cron: {self.config['cron_expression']}")
            else:
                trigger = IntervalTrigger(minutes=self.config['interval_minutes'])
                logger.info(f"Scheduling with interval: {self.config['interval_minutes']} minutes")

            self.scheduler.add_job(
                self._run_healthcheck,
                trigger=trigger,
                id='gateway_healthcheck',
                name='Gateway Model Healthcheck',
                replace_existing=True,
                coalesce=True,
                misfire_grace_time=300,  # Allow 5 minute grace period
            )

            logger.info("Healthcheck job scheduled successfully")

        except Exception as e:
            logger.error(f"Failed to schedule healthcheck: {e}")
            raise

    def _run_healthcheck(self):
        """Execute the healthcheck"""
        try:
            logger.info("=" * 80)
            logger.info("Starting scheduled healthcheck...")
            logger.info("=" * 80)

            run_timestamp = datetime.now(timezone.utc).isoformat()
            self.last_run_timestamp = run_timestamp

            # Run the healthcheck
            results = run_all_gateways_healthcheck(
                specific_gateway=None,
                export_json=self.config['export_json']
            )

            self.last_run_results = results

            # Save timestamped results if history tracking is enabled
            if self.config['keep_history']:
                self._save_history(results)

            # Check for issues and notify if needed
            if self.config['notify_on_unhealthy']:
                self._check_and_notify(results)

            logger.info("Healthcheck completed successfully")
            logger.info("=" * 80)

        except Exception as e:
            logger.error(f"Error during scheduled healthcheck: {e}", exc_info=True)
            self._notify_error(str(e))

    def _save_history(self, results: dict):
        """Save timestamped results to history"""
        try:
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            history_file = results_dir / f"healthcheck_{timestamp}.json"

            with open(history_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)

            logger.info(f"Saved healthcheck results to {history_file}")

            # Clean up old history files if needed
            self._cleanup_old_history()

        except Exception as e:
            logger.error(f"Failed to save history: {e}")

    def _cleanup_old_history(self):
        """Remove old history files beyond retention limit"""
        try:
            max_files = self.config.get('max_history_files', 168)
            history_files = sorted(results_dir.glob('healthcheck_*.json'), reverse=True)

            if len(history_files) > max_files:
                for old_file in history_files[max_files:]:
                    old_file.unlink()
                    logger.debug(f"Removed old history file: {old_file}")

        except Exception as e:
            logger.error(f"Failed to cleanup old history: {e}")

    def _check_and_notify(self, results: dict):
        """Check results and send notification if unhealthy gateways detected"""
        try:
            unhealthy_count = results.get('unhealthy_gateways', 0)
            degraded_count = results.get('degraded_gateways', 0)

            if unhealthy_count > 0 or degraded_count > 0:
                message = (
                    f"⚠️  Healthcheck Alert: "
                    f"{unhealthy_count} unhealthy, {degraded_count} degraded gateways"
                )
                logger.warning(message)

                # Send webhook notification if configured
                if self.config.get('notification_webhook'):
                    self._send_webhook_notification(message, results)

        except Exception as e:
            logger.error(f"Failed to check and notify: {e}")

    def _notify_error(self, error_message: str):
        """Send error notification"""
        try:
            if self.config.get('notification_webhook'):
                self._send_webhook_notification(
                    f"❌ Healthcheck Error: {error_message}",
                    {'error': error_message}
                )
        except Exception as e:
            logger.error(f"Failed to send error notification: {e}")

    def _send_webhook_notification(self, message: str, details: dict):
        """Send notification to configured webhook"""
        try:
            import httpx

            webhook_url = self.config['notification_webhook']
            payload = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'message': message,
                'details': details
            }

            response = httpx.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()

            logger.debug(f"Webhook notification sent successfully")

        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")

    def get_status(self) -> dict:
        """Get current scheduler status"""
        return {
            'running': self.scheduler.running,
            'jobs': len(self.scheduler.get_jobs()),
            'last_run_timestamp': self.last_run_timestamp,
            'last_run_summary': {
                'total_gateways': self.last_run_results.get('total_gateways', 0),
                'healthy_gateways': self.last_run_results.get('healthy_gateways', 0),
                'unhealthy_gateways': self.last_run_results.get('unhealthy_gateways', 0),
            } if self.last_run_results else None
        }

    def start(self):
        """Start the scheduler"""
        try:
            self.schedule_healthcheck()
            self.scheduler.start()

            # Register cleanup on exit
            atexit.register(self.shutdown)

            logger.info("Scheduler started successfully")

            # Run initial healthcheck immediately
            logger.info("Running initial healthcheck...")
            self._run_healthcheck()

            # Keep scheduler running
            try:
                self.scheduler.join()
            except KeyboardInterrupt:
                logger.info("Received interrupt signal, shutting down...")
                self.shutdown()

        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")
            raise

    def shutdown(self):
        """Shutdown the scheduler gracefully"""
        try:
            if self.scheduler.running:
                logger.info("Shutting down scheduler...")
                self.scheduler.shutdown()
                logger.info("Scheduler shutdown complete")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Healthcheck scheduler for gateway models'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=60,
        help='Interval in minutes between healthchecks (default: 60)'
    )
    parser.add_argument(
        '--cron',
        type=str,
        help='Cron expression for scheduling (e.g., "0 * * * *" for hourly)'
    )
    parser.add_argument(
        '--config',
        type=str,
        help='Path to configuration JSON file'
    )
    parser.add_argument(
        '--status',
        action='store_true',
        help='Show scheduler status and exit'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Verbose logging output'
    )

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Load or create configuration
    config = None
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config = json.load(f)
            logger.info(f"Loaded config from {args.config}")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            sys.exit(1)

    # Override with command-line arguments
    if not config:
        config = {}

    if args.cron:
        config['schedule_type'] = 'cron'
        config['cron_expression'] = args.cron
    elif args.interval:
        config['schedule_type'] = 'interval'
        config['interval_minutes'] = args.interval

    # Create and start scheduler
    scheduler = HealthcheckScheduler(config)

    if args.status:
        print(json.dumps(scheduler.get_status(), indent=2, default=str))
        sys.exit(0)

    # Start the scheduler
    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("Scheduler interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
