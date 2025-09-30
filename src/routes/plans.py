import logging
import datetime
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, HTTPException, Query

from src.db.plans import get_all_plans, get_plan_by_id, get_user_plan, get_user_usage_within_plan_limits, \
    check_plan_entitlements, assign_user_plan
from src.db.rate_limits import get_environment_usage_summary
from src.db.users import get_user
from src.main import app
from src.models import PlanResponse, UserPlanResponse, PlanUsageResponse, PlanEntitlementsResponse, AssignPlanRequest
from src.security.deps import get_api_key

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

#Plan Management Endpoints
@app.get("/plans", response_model=List[PlanResponse], tags=["plans"])
async def get_plans():
    """Get all available subscription plans"""
    try:
        logger.info("Attempting to get all plans...")
        plans = get_all_plans()
        logger.info(f"Successfully retrieved {len(plans) if plans else 0} plans")

        if not plans:
            logger.warning("No plans found in database")
            return []

        # Convert to PlanResponse format
        plan_responses = []
        for plan in plans:
            try:
                # Handle features field - convert from dict to list if needed
                features = plan.get("features", [])
                if isinstance(features, dict):
                    # Convert dict to a list of feature names
                    features = list(features.keys())
                elif not isinstance(features, list):
                    features = []

                plan_response = {
                    "id": plan.get("id"),
                    "name": plan.get("name"),
                    "description": plan.get("description"),
                    "plan_type": plan.get("plan_type", "free"),
                    "daily_request_limit": plan.get("daily_request_limit"),
                    "monthly_request_limit": plan.get("monthly_request_limit"),
                    "daily_token_limit": plan.get("daily_token_limit"),
                    "monthly_token_limit": plan.get("monthly_token_limit"),
                    "price_per_month": float(plan.get("price_per_month", 0)),
                    "yearly_price": float(plan.get("yearly_price", 0)) if plan.get("yearly_price") else None,
                    "price_per_token": float(plan.get("price_per_token", 0)) if plan.get("price_per_token") else None,
                    "is_pay_as_you_go": plan.get("is_pay_as_you_go", False),
                    "max_concurrent_requests": plan.get("max_concurrent_requests", 5),
                    "features": features,
                    "is_active": plan.get("is_active", True)
                }
                plan_responses.append(plan_response)
            except Exception as plan_error:
                logger.error(f"Error processing plan {plan.get('id', 'unknown')}: {plan_error}")
                continue

        # Sort plans by type (Free, Dev, Team, Customize)
        plan_order = {'free': 0, 'dev': 1, 'team': 2, 'customize': 3}
        plan_responses.sort(key=lambda x: plan_order.get(x.get('plan_type', 'free'), 999))

        logger.info(f"Returning {len(plan_responses)} plan responses")
        return plan_responses

    except Exception as e:
        logger.error(f"Error getting plans: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/plans/{plan_id}", response_model=PlanResponse, tags=["plans"])
async def get_plan(plan_id: int):
    """Get a specific plan by ID"""
    try:
        plan = get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting plan {plan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan", response_model=UserPlanResponse, tags=["authentication"])
async def get_user_plan_endpoint(api_key: str = Depends(get_api_key)):
    """Get current user's plan"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        user_plan = get_user_plan(user["id"])
        if not user_plan:
            raise HTTPException(status_code=404, detail="No active plan found")

        return user_plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user plan: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan/usage", response_model=PlanUsageResponse, tags=["authentication"])
async def get_user_plan_usage(api_key: str = Depends(get_api_key)):
    """Get user's plan usage and limits"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        usage_data = get_user_usage_within_plan_limits(user["id"])
        if not usage_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage data")

        return usage_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user plan usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan/entitlements", response_model=PlanEntitlementsResponse, tags=["authentication"])
async def get_user_plan_entitlements(api_key: str = Depends(get_api_key), feature: Optional[str] = Query(None)):
    """Check user's plan entitlements"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        entitlements = check_plan_entitlements(user["id"], feature)
        return entitlements

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking user plan entitlements: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/admin/assign-plan", tags=["admin"])
async def assign_plan_to_user(request: AssignPlanRequest):
    """Assign a plan to a user (Admin only)"""
    try:
        success = assign_user_plan(request.user_id, request.plan_id, request.duration_months)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to assign plan")

        return {
            "status": "success",
            "message": f"Plan {request.plan_id} assigned to user {request.user_id} for {request.duration_months} months",
            "user_id": request.user_id,
            "plan_id": request.plan_id,
            "duration_months": request.duration_months,
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error assigning plan: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/environment-usage", tags=["authentication"])
async def get_user_environment_usage(api_key: str = Depends(get_api_key)):
    """Get user's usage breakdown by environment"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        env_usage = get_environment_usage_summary(user["id"])

        return {
            "status": "success",
            "user_id": user["id"],
            "environment_usage": env_usage,
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting environment usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Trial Status Endpoint (Simplified)

@app.get("/trial/status", tags=["trial"])
async def get_trial_status(api_key: str = Depends(get_api_key)):
    """Get the current trial status for the authenticated API key"""
    try:
        from src.trials.trial_validation import validate_trial_access
        trial_status = validate_trial_access(api_key)

        return {
            "success": True,
            "trial_status": trial_status,
            "message": "Trial status retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting trial status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/subscription/plans", tags=["subscription"])
async def get_subscription_plans():
    """Get available subscription plans with 4-tier structure"""
    try:
        # Get all plans from a database
        plans = get_all_plans()

        # Enhance plans with additional information
        enhanced_plans = []
        for plan in plans:
            plan_type = plan.get('plan_type', 'free')
            is_pay_as_you_go = plan.get('is_pay_as_you_go', False)

            enhanced_plan = {
                "id": plan.get('id'),
                "name": plan.get('name'),
                "description": plan.get('description'),
                "plan_type": plan_type,
                "monthly_price": float(plan.get('price_per_month', 0)),
                "yearly_price": float(plan.get('yearly_price', 0)) if plan.get('yearly_price') else None,
                "price_per_token": float(plan.get('price_per_token', 0)) if plan.get('price_per_token') else None,
                "is_pay_as_you_go": is_pay_as_you_go,
                "daily_request_limit": plan.get('daily_request_limit', 0),
                "monthly_request_limit": plan.get('monthly_request_limit', 0),
                "daily_token_limit": plan.get('daily_token_limit', 0),
                "monthly_token_limit": plan.get('monthly_token_limit', 0),
                "max_concurrent_requests": plan.get('max_concurrent_requests', 5),
                "features": plan.get('features', []),
                "is_active": plan.get('is_active', True),
                "trial_eligible": plan_type == 'free'  # Only the Free plan is trial eligible
            }
            enhanced_plans.append(enhanced_plan)

        # Sort plans by price (Free, Dev, Team, Customize)
        plan_order = {'free': 0, 'dev': 1, 'team': 2, 'customize': 3}
        enhanced_plans.sort(key=lambda x: plan_order.get(x['plan_type'], 999))

        return {
            "success": True,
            "plans": enhanced_plans,
            "message": "Subscription plans retrieved successfully",
            "trial_info": {
                "trial_days": 3,
                "trial_credits": 10.0,
                "trial_tokens": 1000000,  # 1M tokens for trial
                "trial_requests": 10000,  # 10K requests for trial
                "trial_plan": "free"
            }
        }
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

