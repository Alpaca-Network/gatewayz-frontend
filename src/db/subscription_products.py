"""
Subscription Products Database Operations
CRUD operations for subscription products in Supabase
"""

import logging
from typing import Any, Optional, Dict

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def get_tier_from_product_id(product_id: str) -> Optional[str]:
    """
    Get subscription tier from product ID
    
    Args:
        product_id: Stripe product ID
        
    Returns:
        Tier name (e.g., 'basic', 'pro', 'max') or None if not found
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
        
        if not result.data:
            logger.warning(f"Product {product_id} not found or inactive")
            return None
            
        return result.data[0].get("tier")
        
    except Exception as e:
        logger.error(f"Error getting tier from product_id {product_id}: {e}")
        return None


def get_credits_from_tier(tier: str) -> Optional[int]:
    """
    Get credit amount for a subscription tier
    
    Args:
        tier: Subscription tier name (e.g., 'basic', 'pro', 'max')
        
    Returns:
        Number of credits or None if not found
    """
    try:
        client = get_supabase_client()
        result = (
            client.table("subscription_products")
            .select("credits")
            .eq("tier", tier)
            .eq("is_active", True)
            .execute()
        )
        
        if not result.data:
            logger.warning(f"Tier {tier} not found or inactive")
            return None
            
        return result.data[0].get("credits")
        
    except Exception as e:
        logger.error(f"Error getting credits from tier {tier}: {e}")
        return None


def get_subscription_product(product_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a subscription product by product ID
    
    Args:
        product_id: Stripe product ID
        
    Returns:
        Subscription product record or None if not found
    """
    try:
        client = get_supabase_client()
        result = (
            client.table("subscription_products")
            .select("*")
            .eq("product_id", product_id)
            .eq("is_active", True)
            .execute()
        )
        
        if not result.data:
            logger.warning(f"Subscription product {product_id} not found or inactive")
            return None
            
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Error getting subscription product {product_id}: {e}")
        return None
