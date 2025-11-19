"""
OpenTelemetry configuration for distributed tracing and observability.

This module configures OpenTelemetry to send traces to Tempo and integrates
with the existing Prometheus metrics and logging infrastructure.

Features:
- Automatic FastAPI request tracing
- HTTPX and Requests library instrumentation
- Context propagation for distributed tracing
- Integration with Railway/Grafana observability stack
"""

import logging
import os
from typing import Optional

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import (
    DEPLOYMENT_ENVIRONMENT,
    SERVICE_NAME,
    SERVICE_VERSION,
    Resource,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from src.config.config import Config

logger = logging.getLogger(__name__)


class OpenTelemetryConfig:
    """
    OpenTelemetry configuration and setup for the Gatewayz API.

    This class handles initialization of:
    - Trace provider with OTLP export to Tempo
    - FastAPI automatic instrumentation
    - HTTP client instrumentation (httpx, requests)
    - Resource attributes (service name, version, environment)
    """

    _initialized = False
    _tracer_provider: Optional[TracerProvider] = None

    @classmethod
    def initialize(cls) -> bool:
        """
        Initialize OpenTelemetry tracing if enabled.

        Returns:
            bool: True if initialization succeeded, False if disabled or failed
        """
        if cls._initialized:
            logger.debug("OpenTelemetry already initialized")
            return True

        if not Config.TEMPO_ENABLED:
            logger.info("⏭️  OpenTelemetry tracing disabled (TEMPO_ENABLED=false)")
            return False

        try:
            logger.info("🔭 Initializing OpenTelemetry tracing...")

            # Create resource with service metadata
            resource = Resource.create(
                {
                    SERVICE_NAME: Config.OTEL_SERVICE_NAME,
                    SERVICE_VERSION: "2.0.3",
                    DEPLOYMENT_ENVIRONMENT: Config.APP_ENV,
                    "service.namespace": "gatewayz",
                    "telemetry.sdk.language": "python",
                }
            )

            # Create tracer provider
            cls._tracer_provider = TracerProvider(resource=resource)

            # Configure OTLP exporter to Tempo
            tempo_endpoint = Config.TEMPO_OTLP_HTTP_ENDPOINT
            logger.info(f"   Tempo endpoint: {tempo_endpoint}")

            otlp_exporter = OTLPSpanExporter(
                endpoint=f"{tempo_endpoint}/v1/traces",
                headers={},  # Add authentication headers if needed
            )

            # Add span processor for exporting traces
            cls._tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

            # In development, also log traces to console
            if Config.IS_DEVELOPMENT:
                cls._tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
                logger.info("   Console trace export enabled (development mode)")

            # Set global tracer provider
            trace.set_tracer_provider(cls._tracer_provider)

            # Instrument HTTP clients for automatic tracing
            HTTPXClientInstrumentor().instrument()
            RequestsInstrumentor().instrument()
            logger.info("   HTTP client instrumentation enabled")

            cls._initialized = True
            logger.info("✅ OpenTelemetry tracing initialized successfully")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize OpenTelemetry: {e}", exc_info=True)
            return False

    @classmethod
    def instrument_fastapi(cls, app) -> None:
        """
        Instrument a FastAPI application with OpenTelemetry.

        This adds automatic tracing for all FastAPI routes and includes:
        - Request/response tracing
        - Route matching information
        - HTTP method and status code
        - Exception tracking

        Args:
            app: FastAPI application instance to instrument
        """
        if not cls._initialized or not Config.TEMPO_ENABLED:
            logger.debug("Skipping FastAPI instrumentation (tracing not enabled)")
            return

        try:
            FastAPIInstrumentor.instrument_app(app)
            logger.info("✅ FastAPI application instrumented with OpenTelemetry")
        except Exception as e:
            logger.error(f"❌ Failed to instrument FastAPI: {e}", exc_info=True)

    @classmethod
    def shutdown(cls) -> None:
        """
        Gracefully shutdown OpenTelemetry and flush any pending spans.

        Should be called during application shutdown to ensure all traces
        are exported before the application exits.
        """
        if not cls._initialized:
            return

        try:
            logger.info("🛑 Shutting down OpenTelemetry...")
            if cls._tracer_provider:
                cls._tracer_provider.shutdown()
            logger.info("✅ OpenTelemetry shutdown complete")
        except Exception as e:
            logger.error(f"❌ Error during OpenTelemetry shutdown: {e}", exc_info=True)
        finally:
            cls._initialized = False
            cls._tracer_provider = None

    @classmethod
    def get_tracer(cls, name: str) -> trace.Tracer:
        """
        Get a tracer for creating custom spans.

        Args:
            name: Name of the tracer (typically __name__ of the calling module)

        Returns:
            OpenTelemetry Tracer instance
        """
        return trace.get_tracer(name)


# Helper function to get current trace context
def get_current_trace_id() -> Optional[str]:
    """
    Get the current trace ID as a hex string.

    Returns:
        str: Trace ID in hex format (32 characters), or None if no active span
    """
    try:
        span = trace.get_current_span()
        span_context = span.get_span_context()
        if span_context.is_valid:
            return format(span_context.trace_id, "032x")
    except Exception:
        pass
    return None


def get_current_span_id() -> Optional[str]:
    """
    Get the current span ID as a hex string.

    Returns:
        str: Span ID in hex format (16 characters), or None if no active span
    """
    try:
        span = trace.get_current_span()
        span_context = span.get_span_context()
        if span_context.is_valid:
            return format(span_context.span_id, "016x")
    except Exception:
        pass
    return None
