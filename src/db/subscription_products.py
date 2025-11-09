#!/usr/bin/env python3
"""
Subscription Products Database Module
Handles retrieval of subscription product configurations
"""

import logging
from typing import Any

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def get_tier_from_product_id(product_id: str) -> str:
    """
    Get subscription tier from Stripe product ID

    Args:
        product_id: Stripe product ID (e.g., prod_TKOqQPhVRxNp4Q)

    Returns:
        Tier name ('basic', 'pro', 'max', etc.) - defaults to 'basic' if not found
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("subscription_products")
            .select("tier")
            .eq("product_id", product_id)
            .eq("is_active", True)
            .execute()
        )

        if result.data:
            tier = result.data[0]["tier"]
            logger.info(f"Product {product_id} mapped to tier: {tier}")
            return tier
        else:
            logger.warning(f"Product {product_id} not found, defaulting to 'basic' tier")
            return "basic"

    except Exception as e:
        logger.error(f"Error getting tier from product ID: {e}", exc_info=True)
        # Default to basic tier on error
        return "basic"


def get_credits_from_tier(tier: str) -> float:
    """
    Get monthly credit allocation for a subscription tier

    Args:
        tier: Subscription tier ('pro', 'max', etc.)

    Returns:
        Monthly credits in USD - defaults to 0 if not found
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("subscription_products")
            .select("credits_per_month")
            .eq("tier", tier)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )

        if result.data:
            credits = float(result.data[0]["credits_per_month"])
            logger.info(f"Tier {tier} has {credits} monthly credits")
            return credits
        else:
            logger.warning(f"Tier {tier} not found, defaulting to 0 credits")
            return 0.0

    except Exception as e:
        logger.error(f"Error getting credits from tier: {e}", exc_info=True)
        # Default to 0 credits on error
        return 0.0


def get_subscription_product(product_id: str) -> dict[str, Any] | None:
    """
    Get full subscription product configuration

    Args:
        product_id: Stripe product ID

    Returns:
        Product configuration dict or None if not found
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("subscription_products")
            .select("*")
            .eq("product_id", product_id)
            .execute()
        )

        if result.data:
            return result.data[0]
        return None

    except Exception as e:
        logger.error(f"Error getting subscription product: {e}", exc_info=True)
        return None


def get_all_active_products() -> list[dict[str, Any]]:
    """
    Get all active subscription products

    Returns:
        List of active product configurations
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("subscription_products")
            .select("*")
            .eq("is_active", True)
            .order("credits_per_month")
            .execute()
        )

        return result.data or []

    except Exception as e:
        logger.error(f"Error getting active products: {e}", exc_info=True)
        return []


def add_subscription_product(
    product_id: str,
    tier: str,
    display_name: str,
    credits_per_month: float,
    description: str | None = None,
    is_active: bool = True
) -> bool:
    """
    Add a new subscription product configuration

    Args:
        product_id: Stripe product ID
        tier: Subscription tier
        display_name: Display-friendly name
        credits_per_month: Monthly credit allocation
        description: Product description
        is_active: Whether product is active

    Returns:
        True if added successfully, False otherwise
    """
    try:
        client = get_supabase_client()

        result = client.table("subscription_products").insert({
            "product_id": product_id,
            "tier": tier,
            "display_name": display_name,
            "credits_per_month": credits_per_month,
            "description": description,
            "is_active": is_active,
        }).execute()

        if result.data:
            logger.info(f"Added subscription product: {product_id} ({tier})")
            return True
        else:
            logger.error(f"Failed to add subscription product: {product_id}")
            return False

    except Exception as e:
        logger.error(f"Error adding subscription product: {e}", exc_info=True)
        return False


def update_subscription_product(
    product_id: str,
    tier: str | None = None,
    display_name: str | None = None,
    credits_per_month: float | None = None,
    description: str | None = None,
    is_active: bool | None = None
) -> bool:
    """
    Update an existing subscription product configuration

    Args:
        product_id: Stripe product ID
        tier: New tier (optional)
        display_name: New display name (optional)
        credits_per_month: New credit allocation (optional)
        description: New description (optional)
        is_active: New active status (optional)

    Returns:
        True if updated successfully, False otherwise
    """
    try:
        client = get_supabase_client()

        # Build update dict with only provided fields
        update_data = {}
        if tier is not None:
            update_data["tier"] = tier
        if display_name is not None:
            update_data["display_name"] = display_name
        if credits_per_month is not None:
            update_data["credits_per_month"] = credits_per_month
        if description is not None:
            update_data["description"] = description
        if is_active is not None:
            update_data["is_active"] = is_active

        if not update_data:
            logger.warning("No fields to update for subscription product")
            return False

        result = (
            client.table("subscription_products")
            .update(update_data)
            .eq("product_id", product_id)
            .execute()
        )

        if result.data:
            logger.info(f"Updated subscription product: {product_id}")
            return True
        else:
            logger.error(f"Failed to update subscription product: {product_id}")
            return False

    except Exception as e:
        logger.error(f"Error updating subscription product: {e}", exc_info=True)
        return False
