"""
Logging configuration with Grafana Loki integration.

This module configures Python logging to send structured logs to Grafana Loki
while maintaining console logging for local development.

Features:
- Structured JSON logging with trace correlation
- Automatic Loki push integration
- Environment-aware configuration
- Trace ID injection for log-to-trace correlation
"""

import logging
import sys
from typing import Dict, Any, Optional

from src.config.config import Config

logger = logging.getLogger(__name__)


class LokiLogHandler(logging.Handler):
    """
    Custom log handler that sends logs to Grafana Loki.

    This handler formats logs as JSON with trace context and pushes them
    to Loki via HTTP API.
    """

    def __init__(self, loki_url: str, tags: Dict[str, str]):
        super().__init__()
        self.loki_url = loki_url
        self.tags = tags
        self._session = None

    def _get_session(self):
        """Lazy-load HTTP session for sending logs with connection limits."""
        if self._session is None:
            import httpx
            # Create client with strict timeouts and connection limits to prevent resource exhaustion
            # Set max_connections to prevent too many concurrent connections
            # Set max_keepalive_connections to limit persistent connections
            limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)
            timeout = httpx.Timeout(5.0, connect=2.0)
            self._session = httpx.Client(timeout=timeout, limits=limits)
        return self._session

    def emit(self, record: logging.LogRecord) -> None:
        """
        Send log record to Loki.

        Args:
            record: LogRecord to send
        """
        try:
            # Format the log message
            log_entry = self.format(record)

            # Get trace context if available
            trace_id = getattr(record, 'trace_id', None)
            span_id = getattr(record, 'span_id', None)

            # Build Loki labels
            labels = {**self.tags}
            if trace_id:
                labels['trace_id'] = trace_id
            if hasattr(record, 'request_path'):
                labels['path'] = record.request_path

            # Build Loki push payload
            # Format: {"streams": [{"stream": {...labels}, "values": [[timestamp_ns, log_line]]}]}
            timestamp_ns = str(int(record.created * 1_000_000_000))
            payload = {
                "streams": [
                    {
                        "stream": labels,
                        "values": [[timestamp_ns, log_entry]]
                    }
                ]
            }

            # Send to Loki with timeout to prevent hanging
            session = self._get_session()
            response = session.post(self.loki_url, json=payload, timeout=5.0)
            response.raise_for_status()

        except Exception:
            # Silently ignore Loki logging failures to prevent cascade errors
            # Do NOT use handleError() as it can trigger recursive logging
            # Do NOT log the error as it can create infinite loops
            # Just continue - the log will be lost but the application won't crash
            pass

    def close(self) -> None:
        """Close HTTP session."""
        if self._session:
            self._session.close()
        super().close()


class TraceContextFilter(logging.Filter):
    """
    Logging filter that adds trace context to log records.

    This filter enriches log records with OpenTelemetry trace and span IDs,
    enabling correlation between logs and traces in Grafana.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Add trace context to log record.

        Args:
            record: LogRecord to enrich

        Returns:
            bool: Always True (don't filter out records)
        """
        try:
            from src.config.opentelemetry_config import get_current_trace_id, get_current_span_id

            trace_id = get_current_trace_id()
            span_id = get_current_span_id()

            if trace_id:
                record.trace_id = trace_id
            if span_id:
                record.span_id = span_id

        except Exception:
            # Don't fail if we can't get trace context
            pass

        return True


class StructuredFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Formats log records as JSON with trace context and additional metadata.
    """

    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON.

        Args:
            record: LogRecord to format

        Returns:
            str: JSON-formatted log entry
        """
        import json

        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add trace context if available
        if hasattr(record, 'trace_id'):
            log_data['trace_id'] = record.trace_id
        if hasattr(record, 'span_id'):
            log_data['span_id'] = record.span_id

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Add any extra fields
        if hasattr(record, 'extra'):
            log_data.update(record.extra)

        return json.dumps(log_data)


def configure_logging() -> bool:
    """
    Configure application logging with Loki integration.

    Sets up:
    - Console handler for local development
    - Loki handler for production (if enabled)
    - Trace context filter for log-to-trace correlation
    - JSON formatting for structured logs

    Returns:
        bool: True if Loki integration was enabled, False otherwise
    """
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Add trace context filter to all loggers
    trace_filter = TraceContextFilter()
    root_logger.addFilter(trace_filter)

    # Console handler (always enabled)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    # Use simple format for console in development, JSON in production
    if Config.IS_DEVELOPMENT:
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    else:
        console_formatter = StructuredFormatter()

    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    logger.info("📝 Console logging configured")

    # Loki handler (optional)
    loki_enabled = False
    if Config.LOKI_ENABLED:
        try:
            loki_handler = LokiLogHandler(
                loki_url=Config.LOKI_PUSH_URL,
                tags={
                    "app": Config.OTEL_SERVICE_NAME,
                    "environment": Config.APP_ENV,
                    "service": "gatewayz-api",
                }
            )
            loki_handler.setLevel(logging.INFO)
            loki_handler.setFormatter(StructuredFormatter())
            root_logger.addHandler(loki_handler)

            logger.info(f"✅ Loki logging enabled: {Config.LOKI_PUSH_URL}")
            loki_enabled = True

        except Exception as e:
            logger.warning(f"⚠️  Failed to configure Loki logging: {e}")

    else:
        logger.info("⏭️  Loki logging disabled (LOKI_ENABLED=false)")

    # Set log levels for noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("opentelemetry").setLevel(logging.WARNING)

    return loki_enabled
