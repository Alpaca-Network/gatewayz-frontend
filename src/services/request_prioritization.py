"""
Request prioritization system for chat completions.

This module provides a priority queue and request classification system to
fast-track high-priority chat completion requests for improved streaming performance.
"""

import logging
from dataclasses import dataclass
from enum import IntEnum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RequestPriority(IntEnum):
    """Priority levels for requests (lower number = higher priority)"""

    CRITICAL = 0  # System-critical requests
    HIGH = 1  # Premium users, paid plans
    MEDIUM = 2  # Standard users
    LOW = 3  # Free tier, trial users
    BACKGROUND = 4  # Background/batch processing


@dataclass
class PriorityRequest:
    """Container for prioritized requests"""

    priority: RequestPriority
    request_id: str
    user_id: Optional[str]
    timestamp: float
    model: str
    stream: bool
    metadata: Dict[str, Any]

    def __lt__(self, other):
        """Compare requests for priority queue ordering"""
        if self.priority != other.priority:
            return self.priority < other.priority
        # If same priority, older requests go first (FIFO within priority)
        return self.timestamp < other.timestamp


class RequestPrioritizer:
    """
    Manages request prioritization for chat completions.

    Uses priority levels to ensure premium users and streaming requests
    get faster processing.
    """

    def __init__(self):
        self._priority_weights = {
            RequestPriority.CRITICAL: 1.0,
            RequestPriority.HIGH: 0.9,
            RequestPriority.MEDIUM: 0.7,
            RequestPriority.LOW: 0.5,
            RequestPriority.BACKGROUND: 0.3,
        }
        self._request_counts: Dict[RequestPriority, int] = dict.fromkeys(RequestPriority, 0)
        self._total_requests = 0

    def determine_priority(
        self,
        user_tier: Optional[str] = None,
        is_streaming: bool = False,
        model: Optional[str] = None,
        is_trial: bool = False,
    ) -> RequestPriority:
        """
        Determine request priority based on user tier and request characteristics.

        Args:
            user_tier: User subscription tier (e.g., 'premium', 'pro', 'free')
            is_streaming: Whether this is a streaming request
            model: Model being requested
            is_trial: Whether user is on trial

        Returns:
            RequestPriority level
        """
        # Trial users get low priority
        if is_trial:
            return RequestPriority.LOW

        # Determine base priority from user tier
        if user_tier in ("enterprise", "premium", "pro"):
            base_priority = RequestPriority.HIGH
        elif user_tier in ("standard", "plus"):
            base_priority = RequestPriority.MEDIUM
        elif user_tier == "free":
            base_priority = RequestPriority.LOW
        else:
            # Default for unknown tier
            base_priority = RequestPriority.MEDIUM

        # Streaming requests get slight boost (one level higher priority)
        if is_streaming and base_priority > RequestPriority.CRITICAL:
            base_priority = RequestPriority(base_priority - 1)

        # Fast models (like GPT-3.5-turbo) can be slightly deprioritized
        # since they're already fast
        if model and any(
            fast_model in model.lower()
            for fast_model in ["3.5-turbo", "gpt-3.5", "llama-3-8b", "mistral-7b"]
        ):
            if base_priority < RequestPriority.BACKGROUND:
                base_priority = RequestPriority(base_priority + 1)

        return base_priority

    def track_request(self, priority: RequestPriority):
        """Track a request for metrics"""
        self._request_counts[priority] += 1
        self._total_requests += 1

    def get_priority_stats(self) -> Dict[str, Any]:
        """Get statistics about request prioritization"""
        if self._total_requests == 0:
            return {
                "total_requests": 0,
                "priority_distribution": {},
            }

        distribution = {
            priority.name: {
                "count": self._request_counts[priority],
                "percentage": (self._request_counts[priority] / self._total_requests) * 100,
            }
            for priority in RequestPriority
        }

        return {
            "total_requests": self._total_requests,
            "priority_distribution": distribution,
        }

    def should_fast_track(self, priority: RequestPriority) -> bool:
        """Determine if a request should be fast-tracked"""
        return priority <= RequestPriority.HIGH

    def get_timeout_multiplier(self, priority: RequestPriority) -> float:
        """Get timeout multiplier based on priority (higher priority = longer timeout)"""
        return self._priority_weights[priority] * 2.0 + 0.5  # Range: 1.1x to 2.5x


# Global prioritizer instance
_prioritizer = RequestPrioritizer()


def get_request_priority(
    user_tier: Optional[str] = None,
    is_streaming: bool = False,
    model: Optional[str] = None,
    is_trial: bool = False,
) -> RequestPriority:
    """
    Get priority for a request.

    Args:
        user_tier: User subscription tier
        is_streaming: Whether this is a streaming request
        model: Model being requested
        is_trial: Whether user is on trial

    Returns:
        RequestPriority level
    """
    priority = _prioritizer.determine_priority(
        user_tier=user_tier,
        is_streaming=is_streaming,
        model=model,
        is_trial=is_trial,
    )
    _prioritizer.track_request(priority)
    return priority


def should_fast_track(priority: RequestPriority) -> bool:
    """Check if request should be fast-tracked"""
    return _prioritizer.should_fast_track(priority)


def get_timeout_for_priority(
    base_timeout: float,
    priority: RequestPriority,
) -> float:
    """
    Get adjusted timeout based on priority.

    Args:
        base_timeout: Base timeout in seconds
        priority: Request priority level

    Returns:
        Adjusted timeout in seconds
    """
    multiplier = _prioritizer.get_timeout_multiplier(priority)
    return base_timeout * multiplier


def get_priority_stats() -> Dict[str, Any]:
    """Get current prioritization statistics"""
    return _prioritizer.get_priority_stats()


def log_request_priority(
    request_id: str,
    priority: RequestPriority,
    user_tier: Optional[str] = None,
    model: Optional[str] = None,
):
    """
    Log request priority information for monitoring.

    Args:
        request_id: Unique request identifier
        priority: Assigned priority level
        user_tier: User subscription tier
        model: Model being requested
    """
    logger.info(
        f"Request {request_id} assigned priority {priority.name} "
        f"(tier={user_tier}, model={model})"
    )


# Provider selection helpers based on priority
def get_preferred_providers_for_priority(
    priority: RequestPriority,
    available_providers: List[str],
) -> List[str]:
    """
    Get preferred providers ordered by priority.

    Higher priority requests get routed to faster/more reliable providers first.

    Args:
        priority: Request priority level
        available_providers: List of available provider names

    Returns:
        Ordered list of provider names
    """
    # Define provider speed/reliability tiers
    tier_1_providers = {"fireworks", "together", "groq"}  # Fastest
    tier_2_providers = {"openrouter", "portkey", "deepinfra"}  # Fast
    tier_3_providers = {"featherless", "huggingface"}  # Slower but reliable

    ordered = []

    # High priority gets tier 1 first
    if priority <= RequestPriority.HIGH:
        ordered.extend([p for p in available_providers if p in tier_1_providers])
        ordered.extend([p for p in available_providers if p in tier_2_providers])
        ordered.extend([p for p in available_providers if p in tier_3_providers])
    # Medium priority gets tier 2 first
    elif priority == RequestPriority.MEDIUM:
        ordered.extend([p for p in available_providers if p in tier_2_providers])
        ordered.extend([p for p in available_providers if p in tier_1_providers])
        ordered.extend([p for p in available_providers if p in tier_3_providers])
    # Low priority can use any provider
    else:
        ordered.extend([p for p in available_providers if p in tier_3_providers])
        ordered.extend([p for p in available_providers if p in tier_2_providers])
        ordered.extend([p for p in available_providers if p in tier_1_providers])

    # Add any remaining providers not in our tiers
    for provider in available_providers:
        if provider not in ordered:
            ordered.append(provider)

    return ordered
