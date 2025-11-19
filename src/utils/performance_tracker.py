"""
Performance tracking utility for detailed stage breakdown monitoring.

This module provides context managers and utilities to track performance
stages identified in profiling:
- Frontend processing (request parsing, auth validation, preparation)
- Backend API response (TTFB)
- Stream processing (streaming response to client)
"""

import logging
import time
from contextlib import contextmanager
from typing import Optional

from src.services.prometheus_metrics import (
    record_stage_percentage,
    track_backend_ttfb,
    track_frontend_processing,
    track_request_stage,
    track_streaming_duration,
)

logger = logging.getLogger(__name__)


class PerformanceTracker:
    """
    Tracks performance metrics for request processing stages.

    Usage:
        tracker = PerformanceTracker(endpoint="/v1/chat/completions")
        with tracker.stage("request_parsing"):
            # parse request
        with tracker.stage("auth_validation"):
            # validate auth
        with tracker.backend_request(provider="openrouter", model="gpt-4"):
            # make backend request
        tracker.record_percentages()
    """

    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self.stage_times: dict[str, float] = {}
        self.total_start_time = time.time()
        self.backend_ttfb_start: Optional[float] = None
        self.backend_ttfb_duration: Optional[float] = None
        self.streaming_start: Optional[float] = None
        self.streaming_duration: Optional[float] = None
        self.provider: Optional[str] = None
        self.model: Optional[str] = None

    @contextmanager
    def stage(self, stage_name: str):
        """Track duration of a processing stage."""
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            self.stage_times[stage_name] = duration
            track_request_stage(stage_name, self.endpoint, duration)
            logger.debug(f"Stage '{stage_name}' took {duration:.4f}s")

    @contextmanager
    def backend_request(self, provider: str, model: str):
        """Track backend API request (TTFB)."""
        self.provider = provider
        self.model = model
        self.backend_ttfb_start = time.time()
        try:
            yield
        finally:
            if self.backend_ttfb_start:
                self.backend_ttfb_duration = time.time() - self.backend_ttfb_start
                track_backend_ttfb(provider, model, self.endpoint, self.backend_ttfb_duration)
                track_request_stage("backend_fetch", self.endpoint, self.backend_ttfb_duration)
                logger.debug(
                    f"Backend TTFB for {provider}/{model}: {self.backend_ttfb_duration:.4f}s"
                )

    @contextmanager
    def streaming(self):
        """Track streaming response duration."""
        self.streaming_start = time.time()
        try:
            yield
        finally:
            if self.streaming_start:
                self.streaming_duration = time.time() - self.streaming_start
                if self.provider and self.model:
                    track_streaming_duration(
                        self.provider, self.model, self.endpoint, self.streaming_duration
                    )
                track_request_stage("stream_processing", self.endpoint, self.streaming_duration)
                logger.debug(f"Streaming duration: {self.streaming_duration:.4f}s")

    def record_percentages(self):
        """Calculate and record stage percentages of total time."""
        total_time = time.time() - self.total_start_time

        if total_time <= 0:
            logger.warning("Total time is zero or negative, skipping percentage calculation")
            return

        # Calculate frontend processing time (sum of parsing, auth, preparation)
        frontend_time = (
            self.stage_times.get("request_parsing", 0)
            + self.stage_times.get("auth_validation", 0)
            + self.stage_times.get("request_preparation", 0)
        )

        # Record frontend processing
        if frontend_time > 0:
            track_frontend_processing(self.endpoint, frontend_time)
            frontend_pct = (frontend_time / total_time) * 100
            record_stage_percentage("frontend_processing", self.endpoint, frontend_pct)

        # Record backend response percentage
        if self.backend_ttfb_duration:
            backend_pct = (self.backend_ttfb_duration / total_time) * 100
            record_stage_percentage("backend_response", self.endpoint, backend_pct)

        # Record streaming percentage
        if self.streaming_duration:
            streaming_pct = (self.streaming_duration / total_time) * 100
            record_stage_percentage("stream_processing", self.endpoint, streaming_pct)

        logger.debug(
            f"Performance breakdown for {self.endpoint}: "
            f"Frontend={frontend_time:.4f}s ({frontend_pct:.1f}%), "
            f"Backend={self.backend_ttfb_duration or 0:.4f}s "
            f"({backend_pct if self.backend_ttfb_duration else 0:.1f}%), "
            f"Streaming={self.streaming_duration or 0:.4f}s "
            f"({streaming_pct if self.streaming_duration else 0:.1f}%)"
        )


@contextmanager
def track_request_stages(endpoint: str):
    """
    Simplified context manager for tracking request stages.

    Usage:
        with track_request_stages("/v1/chat/completions") as tracker:
            with tracker.stage("request_parsing"):
                # parse request
            with tracker.backend_request("openrouter", "gpt-4"):
                # make request
            tracker.record_percentages()
    """
    tracker = PerformanceTracker(endpoint)
    try:
        yield tracker
    finally:
        tracker.record_percentages()
