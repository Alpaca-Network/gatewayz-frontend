#!/usr/bin/env python3
"""
Trial Management Service
Handles free trial logic, expiration, and conversion to paid subscriptions
"""

import logging
from datetime import datetime
from typing import Optional
from supabase import create_client, Client
import os

from src.schemas.trial_models import StartTrialRequest, StartTrialResponse, SubscriptionStatus, TrialStatusResponse, \
    TrialStatus, ConvertTrialRequest, ConvertTrialResponse, TrackUsageRequest, TrackUsageResponse, \
    SubscriptionPlansResponse, SubscriptionPlan, PlanType, TrialValidationResult

logger = logging.getLogger(__name__)

class TrialService:
    """Service for managing free trials and subscriptions"""
    
    def __init__(self):
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_KEY")
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
    
    async def start_trial(self, request: StartTrialRequest) -> StartTrialResponse:
        """Start a free trial for an API key"""
        try:
            # Get API key ID
            api_key_id = await self._get_api_key_id(request.api_key)
            if not api_key_id:
                return StartTrialResponse(
                    success=False,
                    trial_start_date=datetime.now(),
                    trial_end_date=datetime.now(),
                    trial_days=request.trial_days,
                    max_tokens=0,
                    max_requests=0,
                    trial_credits=0.0,
                    message="API key not found"
                )
            
            # Check if already has trial or subscription
            current_status = await self.get_trial_status(request.api_key)
            if current_status.trial_status.is_trial or current_status.trial_status.subscription_status != SubscriptionStatus.TRIAL:
                return StartTrialResponse(
                    success=False,
                    trial_start_date=datetime.now(),
                    trial_end_date=datetime.now(),
                    trial_days=request.trial_days,
                    max_tokens=0,
                    max_requests=0,
                    trial_credits=0.0,
                    message="Trial already started or subscription active"
                )
            
            # Call database function to start trial
            result = self.supabase.rpc('start_trial', {
                'api_key_id': api_key_id,
                'trial_days': request.trial_days
            }).execute()
            
            if result.data and result.data.get('success'):
                trial_data = result.data
                return StartTrialResponse(
                    success=True,
                    trial_start_date=datetime.fromisoformat(trial_data['trial_start_date'].replace('Z', '+00:00')),
                    trial_end_date=datetime.fromisoformat(trial_data['trial_end_date'].replace('Z', '+00:00')),
                    trial_days=trial_data['trial_days'],
                    max_tokens=trial_data['max_tokens'],
                    max_requests=trial_data['max_requests'],
                    trial_credits=trial_data['trial_credits'],
                    message="Trial started successfully"
                )
            else:
                error_msg = result.data.get('error', 'Unknown error') if result.data else 'Database error'
                return StartTrialResponse(
                    success=False,
                    trial_start_date=datetime.now(),
                    trial_end_date=datetime.now(),
                    trial_days=request.trial_days,
                    max_tokens=0,
                    max_requests=0,
                    trial_credits=0.0,
                    message=f"Failed to start trial: {error_msg}"
                )
                
        except Exception as e:
            logger.error(f"Error starting trial: {e}")
            return StartTrialResponse(
                success=False,
                trial_start_date=datetime.now(),
                trial_end_date=datetime.now(),
                trial_days=request.trial_days,
                max_tokens=0,
                max_requests=0,
                trial_credits=0.0,
                message=f"Internal error: {str(e)}"
            )
    
    async def get_trial_status(self, api_key: str) -> TrialStatusResponse:
        """Get current trial status for an API key"""
        try:
            api_key_id = await self._get_api_key_id(api_key)
            if not api_key_id:
                return TrialStatusResponse(
                    success=False,
                    trial_status=TrialStatus(is_trial=False),
                    message="API key not found"
                )
            
            # Call database function to get trial status
            result = self.supabase.rpc('check_trial_status', {
                'api_key_id': api_key_id
            }).execute()
            
            if result.data and not result.data.get('error'):
                trial_data = result.data
                trial_status = TrialStatus(
                    is_trial=trial_data['is_trial'],
                    trial_start_date=datetime.fromisoformat(trial_data['trial_start_date'].replace('Z', '+00:00')) if trial_data['trial_start_date'] else None,
                    trial_end_date=datetime.fromisoformat(trial_data['trial_end_date'].replace('Z', '+00:00')) if trial_data['trial_end_date'] else None,
                    trial_used_tokens=trial_data['trial_used_tokens'],
                    trial_used_requests=trial_data['trial_used_requests'],
                    trial_max_tokens=trial_data['trial_max_tokens'],
                    trial_max_requests=trial_data['trial_max_requests'],
                    trial_credits=trial_data.get('trial_credits', 10.00),
                    trial_used_credits=trial_data.get('trial_used_credits', 0.00),
                    trial_converted=trial_data['trial_converted'],
                    subscription_status=SubscriptionStatus(trial_data['subscription_status']),
                    subscription_plan=trial_data['subscription_plan'],
                    trial_active=trial_data['trial_active'],
                    trial_expired=trial_data['trial_expired'],
                    trial_remaining_tokens=trial_data['trial_remaining_tokens'],
                    trial_remaining_requests=trial_data['trial_remaining_requests'],
                    trial_remaining_credits=trial_data.get('trial_remaining_credits', 10.00)
                )
                
                return TrialStatusResponse(
                    success=True,
                    trial_status=trial_status,
                    message="Trial status retrieved successfully"
                )
            else:
                error_msg = result.data.get('error', 'Unknown error') if result.data else 'Database error'
                return TrialStatusResponse(
                    success=False,
                    trial_status=TrialStatus(is_trial=False),
                    message=f"Failed to get trial status: {error_msg}"
                )
                
        except Exception as e:
            logger.error(f"Error getting trial status: {e}")
            return TrialStatusResponse(
                success=False,
                trial_status=TrialStatus(is_trial=False),
                message=f"Internal error: {str(e)}"
            )
    
    async def convert_trial_to_paid(self, request: ConvertTrialRequest) -> ConvertTrialResponse:
        """Convert trial to paid subscription"""
        try:
            api_key_id = await self._get_api_key_id(request.api_key)
            if not api_key_id:
                return ConvertTrialResponse(
                    success=False,
                    converted_plan="",
                    conversion_date=datetime.now(),
                    monthly_price=0.0,
                    subscription_end_date=datetime.now(),
                    message="API key not found"
                )
            
            # Call database function to convert trial
            result = self.supabase.rpc('convert_trial_to_paid', {
                'api_key_id': api_key_id,
                'plan_name': request.plan_name
            }).execute()
            
            if result.data and result.data.get('success'):
                conversion_data = result.data
                return ConvertTrialResponse(
                    success=True,
                    converted_plan=conversion_data['converted_plan'],
                    conversion_date=datetime.fromisoformat(conversion_data['conversion_date'].replace('Z', '+00:00')),
                    monthly_price=conversion_data['monthly_price'],
                    subscription_end_date=datetime.fromisoformat(conversion_data['subscription_end_date'].replace('Z', '+00:00')),
                    message="Trial converted to paid subscription successfully"
                )
            else:
                error_msg = result.data.get('error', 'Unknown error') if result.data else 'Database error'
                return ConvertTrialResponse(
                    success=False,
                    converted_plan="",
                    conversion_date=datetime.now(),
                    monthly_price=0.0,
                    subscription_end_date=datetime.now(),
                    message=f"Failed to convert trial: {error_msg}"
                )
                
        except Exception as e:
            logger.error(f"Error converting trial: {e}")
            return ConvertTrialResponse(
                success=False,
                converted_plan="",
                conversion_date=datetime.now(),
                monthly_price=0.0,
                subscription_end_date=datetime.now(),
                message=f"Internal error: {str(e)}"
            )
    
    async def track_trial_usage(self, request: TrackUsageRequest) -> TrackUsageResponse:
        """Track usage for trial users"""
        try:
            api_key_id = await self._get_api_key_id(request.api_key)
            if not api_key_id:
                return TrackUsageResponse(
                    success=False,
                    daily_requests_used=0,
                    daily_tokens_used=0,
                    total_trial_requests=0,
                    total_trial_tokens=0,
                    remaining_tokens=0,
                    remaining_requests=0,
                    message="API key not found"
                )
            
            # Call database function to track usage
            result = self.supabase.rpc('track_trial_usage', {
                'api_key_id': api_key_id,
                'tokens_used': request.tokens_used,
                'requests_used': request.requests_used,
                'credits_used': request.credits_used
            }).execute()
            
            if result.data and result.data.get('success'):
                usage_data = result.data
                return TrackUsageResponse(
                    success=True,
                    daily_requests_used=usage_data['daily_requests_used'],
                    daily_tokens_used=usage_data['daily_tokens_used'],
                    total_trial_requests=usage_data['total_trial_requests'],
                    total_trial_tokens=usage_data['total_trial_tokens'],
                    total_trial_credits_used=usage_data['total_trial_credits_used'],
                    remaining_tokens=usage_data['remaining_tokens'],
                    remaining_requests=usage_data['remaining_requests'],
                    remaining_credits=usage_data['remaining_credits'],
                    message="Usage tracked successfully"
                )
            else:
                error_msg = result.data.get('error', 'Unknown error') if result.data else 'Database error'
                return TrackUsageResponse(
                    success=False,
                    daily_requests_used=0,
                    daily_tokens_used=0,
                    total_trial_requests=0,
                    total_trial_tokens=0,
                    total_trial_credits_used=0.0,
                    remaining_tokens=0,
                    remaining_requests=0,
                    remaining_credits=0.0,
                    message=f"Failed to track usage: {error_msg}"
                )
                
        except Exception as e:
            logger.error(f"Error tracking trial usage: {e}")
            return TrackUsageResponse(
                success=False,
                daily_requests_used=0,
                daily_tokens_used=0,
                total_trial_requests=0,
                total_trial_tokens=0,
                total_trial_credits_used=0.0,
                remaining_tokens=0,
                remaining_requests=0,
                remaining_credits=0.0,
                message=f"Internal error: {str(e)}"
            )
    
    async def get_subscription_plans(self) -> SubscriptionPlansResponse:
        """Get available subscription plans"""
        try:
            result = self.supabase.table('subscription_plans').select('*').eq('is_active', True).execute()
            
            if result.data:
                plans = []
                for plan_data in result.data:
                    plan = SubscriptionPlan(
                        id=plan_data['id'],
                        plan_name=plan_data['plan_name'],
                        plan_type=PlanType(plan_data['plan_type']),
                        monthly_price=plan_data['monthly_price'],
                        yearly_price=plan_data['yearly_price'],
                        max_requests_per_month=plan_data['max_requests_per_month'],
                        max_tokens_per_month=plan_data['max_tokens_per_month'],
                        max_requests_per_day=plan_data['max_requests_per_day'],
                        max_tokens_per_day=plan_data['max_tokens_per_day'],
                        max_concurrent_requests=plan_data['max_concurrent_requests'],
                        features=plan_data['features'],
                        is_active=plan_data['is_active'],
                        created_at=datetime.fromisoformat(plan_data['created_at'].replace('Z', '+00:00')) if plan_data['created_at'] else None,
                        updated_at=datetime.fromisoformat(plan_data['updated_at'].replace('Z', '+00:00')) if plan_data['updated_at'] else None
                    )
                    plans.append(plan)
                
                return SubscriptionPlansResponse(
                    success=True,
                    plans=plans,
                    message="Subscription plans retrieved successfully"
                )
            else:
                return SubscriptionPlansResponse(
                    success=False,
                    plans=[],
                    message="No subscription plans found"
                )
                
        except Exception as e:
            logger.error(f"Error getting subscription plans: {e}")
            return SubscriptionPlansResponse(
                success=False,
                plans=[],
                message=f"Internal error: {str(e)}"
            )
    
    async def validate_trial_access(self, api_key: str, tokens_used: int = 0, requests_used: int = 1) -> TrialValidationResult:
        """Validate if API key has trial access for the requested usage"""
        try:
            trial_status = await self.get_trial_status(api_key)
            if not trial_status.success:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=False,
                    is_expired=False,
                    remaining_tokens=0,
                    remaining_requests=0,
                    error_message="Failed to get trial status"
                )
            
            status = trial_status.trial_status
            
            # Check if it's a trial
            if not status.is_trial:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=False,
                    is_expired=False,
                    remaining_tokens=0,
                    remaining_requests=0,
                    error_message="Not a trial account"
                )
            
            # Check if trial is expired
            if status.trial_expired:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=True,
                    is_expired=True,
                    remaining_tokens=0,
                    remaining_requests=0,
                    trial_end_date=status.trial_end_date,
                    error_message="Trial has expired"
                )
            
            # Check if trial has remaining tokens/requests/credits
            if status.trial_remaining_tokens < tokens_used:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=True,
                    is_expired=False,
                    remaining_tokens=status.trial_remaining_tokens,
                    remaining_requests=status.trial_remaining_requests,
                    remaining_credits=status.trial_remaining_credits,
                    trial_end_date=status.trial_end_date,
                    error_message="Trial token limit exceeded"
                )
            
            if status.trial_remaining_requests < requests_used:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=True,
                    is_expired=False,
                    remaining_tokens=status.trial_remaining_tokens,
                    remaining_requests=status.trial_remaining_requests,
                    remaining_credits=status.trial_remaining_credits,
                    trial_end_date=status.trial_end_date,
                    error_message="Trial request limit exceeded"
                )
            
            # Check credit limit (standard pricing: $20 for 1M tokens = $0.00002 per token)
            estimated_credit_cost = tokens_used * 0.00002
            if status.trial_remaining_credits < estimated_credit_cost:
                return TrialValidationResult(
                    is_valid=False,
                    is_trial=True,
                    is_expired=False,
                    remaining_tokens=status.trial_remaining_tokens,
                    remaining_requests=status.trial_remaining_requests,
                    remaining_credits=status.trial_remaining_credits,
                    trial_end_date=status.trial_end_date,
                    error_message="Trial credit limit exceeded"
                )
            
            return TrialValidationResult(
                is_valid=True,
                is_trial=True,
                is_expired=False,
                remaining_tokens=status.trial_remaining_tokens,
                remaining_requests=status.trial_remaining_requests,
                remaining_credits=status.trial_remaining_credits,
                trial_end_date=status.trial_end_date
            )
            
        except Exception as e:
            logger.error(f"Error validating trial access: {e}")
            return TrialValidationResult(
                is_valid=False,
                is_trial=False,
                is_expired=False,
                remaining_tokens=0,
                remaining_requests=0,
                remaining_credits=0.0,
                error_message=f"Internal error: {str(e)}"
            )
    
    async def _get_api_key_id(self, api_key: str) -> Optional[int]:
        """Get API key ID from the key string"""
        try:
            result = self.supabase.table('api_keys').select('id').eq('key', api_key).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]['id']
            return None
        except Exception as e:
            logger.error(f"Error getting API key ID: {e}")
            return None

# Global trial service instance
_trial_service = None

def get_trial_service() -> TrialService:
    """Get global trial service instance"""
    global _trial_service
    if _trial_service is None:
        _trial_service = TrialService()
    return _trial_service
