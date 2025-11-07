"""
Prometheus Remote Write integration for Railway Grafana stack.

This module handles pushing metrics to Prometheus via remote_write,
which is the recommended method for agent-based monitoring in Railway.

The Railway Grafana stack template comes with Prometheus pre-configured
to receive metrics via:
- HTTP remote_write endpoint: /api/v1/write
- Internal URL: http://prometheus:9090
"""

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import httpx
from prometheus_client import REGISTRY, generate_latest

from src.config import Config

logger = logging.getLogger(__name__)


class PrometheusRemoteWriter:
    """
    Client for pushing Prometheus metrics via remote_write.

    This follows the Prometheus remote write protocol:
    - Metrics are collected from the local registry
    - Serialized to Prometheus text format
    - Sent to the remote Prometheus instance via HTTP POST
    """

    def __init__(
        self,
        remote_write_url: str = None,
        push_interval: int = 30,
        enabled: bool = True,
    ):
        """
        Initialize the Prometheus remote writer.

        Args:
            remote_write_url: URL of Prometheus remote_write endpoint
                            Default: http://prometheus:9090/api/v1/write
            push_interval: Interval in seconds between metric pushes (default: 30s)
            enabled: Whether to enable remote write (default: True)
        """
        self.remote_write_url = remote_write_url or Config.PROMETHEUS_REMOTE_WRITE_URL
        self.push_interval = push_interval
        self.enabled = enabled
        self.client = None
        self._push_task = None
        self._last_push_time = 0
        self._push_count = 0
        self._push_errors = 0

        logger.info(f"Prometheus Remote Writer initialized")
        logger.info(f"  URL: {self.remote_write_url}")
        logger.info(f"  Push interval: {self.push_interval}s")
        logger.info(f"  Enabled: {self.enabled}")

    async def start(self):
        """Start the background push task."""
        if not self.enabled:
            logger.info("Prometheus remote write is disabled")
            return

        self.client = httpx.AsyncClient(timeout=10.0)
        self._push_task = asyncio.create_task(self._push_loop())
        logger.info("Prometheus remote write task started")

    async def stop(self):
        """Stop the background push task and cleanup."""
        if self._push_task:
            self._push_task.cancel()
            try:
                await self._push_task
            except asyncio.CancelledError:
                pass

        if self.client:
            await self.client.aclose()

        logger.info(
            f"Prometheus remote write stopped "
            f"(pushed {self._push_count} times, {self._push_errors} errors)"
        )

    async def _push_loop(self):
        """Background task that pushes metrics at regular intervals."""
        while True:
            try:
                await asyncio.sleep(self.push_interval)
                await self.push_metrics()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in prometheus push loop: {e}")
                self._push_errors += 1

    async def push_metrics(self) -> bool:
        """
        Push current metrics to Prometheus remote_write endpoint.

        Returns:
            True if push was successful, False otherwise
        """
        if not self.enabled or not self.client:
            return False

        try:
            # Collect metrics from Prometheus client library
            metrics_data = generate_latest(REGISTRY)

            # Send to remote Prometheus
            response = await self.client.post(
                self.remote_write_url,
                content=metrics_data,
                headers={"Content-Type": "text/plain; charset=utf-8"},
            )

            self._last_push_time = time.time()
            self._push_count += 1

            if response.status_code in (200, 201, 204):
                logger.debug(
                    f"Successfully pushed metrics to Prometheus "
                    f"({len(metrics_data)} bytes, status {response.status_code})"
                )
                return True
            else:
                logger.warning(
                    f"Prometheus remote write returned status {response.status_code}: "
                    f"{response.text[:200]}"
                )
                self._push_errors += 1
                return False

        except httpx.TimeoutException:
            logger.error("Timeout pushing metrics to Prometheus")
            self._push_errors += 1
            return False
        except Exception as e:
            logger.error(f"Error pushing metrics to Prometheus: {e}")
            self._push_errors += 1
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get remote write statistics."""
        return {
            "enabled": self.enabled,
            "url": self.remote_write_url,
            "push_interval": self.push_interval,
            "push_count": self._push_count,
            "push_errors": self._push_errors,
            "last_push_time": self._last_push_time,
            "success_rate": (
                (self._push_count - self._push_errors) / self._push_count * 100
                if self._push_count > 0
                else 0
            ),
        }


# Global instance
prometheus_writer: Optional[PrometheusRemoteWriter] = None


async def init_prometheus_remote_write():
    """Initialize Prometheus remote write on startup."""
    global prometheus_writer

    if not Config.PROMETHEUS_ENABLED:
        logger.info("Prometheus monitoring is disabled")
        return

    prometheus_writer = PrometheusRemoteWriter(
        remote_write_url=Config.PROMETHEUS_REMOTE_WRITE_URL,
        push_interval=30,  # Push every 30 seconds
        enabled=True,
    )

    await prometheus_writer.start()
    logger.info("Prometheus remote write initialized")


async def shutdown_prometheus_remote_write():
    """Shutdown Prometheus remote write on shutdown."""
    global prometheus_writer

    if prometheus_writer:
        await prometheus_writer.stop()
        stats = prometheus_writer.get_stats()
        logger.info(f"Prometheus remote write stats: {stats}")


def get_prometheus_writer() -> Optional[PrometheusRemoteWriter]:
    """Get the global Prometheus remote writer instance."""
    return prometheus_writer
