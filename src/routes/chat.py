import logging
import httpx
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from src.db.api_keys import increment_api_key_usage
from src.db.plans import enforce_plan_limits
from src.db.rate_limits import create_rate_limit_alert, update_rate_limit_usage
from src.db.users import get_user, deduct_credits, record_usage
from src.db.chat_history import create_chat_session, save_chat_message, get_chat_session
from src.schemas import ProxyRequest
from src.security.deps import get_api_key
from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response
from src.services.portkey_client import make_portkey_request_openai, process_portkey_response
from src.services.rate_limiting import get_rate_limit_manager
from src.services.trial_validation import validate_trial_access, track_trial_usage

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/v1/chat/completions", tags=["chat"])
async def chat_completions(
    req: ProxyRequest, 
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to")
):
    """
    OpenAI-compatible chat completions endpoint.

    Handles credit deduction, rate limiting, trial validation, and proxies requests to OpenRouter.
    Supports all OpenAI-compatible clients and model providers.
    """
    try:
        # Get running event loop for async operations
        loop = asyncio.get_running_loop()

        # Create thread pool executor for sync database operations
        executor = ThreadPoolExecutor()

        try:
            # Get user asynchronously
            user = await loop.run_in_executor(executor, get_user, api_key)

            if not user:
                raise HTTPException(status_code=401, detail="Invalid API key")

            # Get environment tag from an API key
            environment_tag = user.get('environment_tag', 'live')

            # Check plan limits first (async)
            plan_check = await loop.run_in_executor(
                executor,
                enforce_plan_limits,
                user['id'],
                0,
                environment_tag
            )
            if not plan_check['allowed']:
                raise HTTPException(
                    status_code=429,
                    detail=f"Plan limit exceeded: {plan_check['reason']}"
                )

            # Check trial status first (simplified)
            trial_validation = await loop.run_in_executor(
                executor,
                validate_trial_access,
                api_key
            )

            if not trial_validation['is_valid']:
                if trial_validation.get('is_trial') and trial_validation.get('is_expired'):
                    raise HTTPException(
                        status_code=403,
                        detail=trial_validation['error'],
                        headers={"X-Trial-Expired": "true", "X-Trial-End-Date": trial_validation.get('trial_end_date', '')}
                    )
                elif trial_validation.get('is_trial'):
                    headers = {}
                    if 'remaining_tokens' in trial_validation:
                        headers["X-Trial-Remaining-Tokens"] = str(trial_validation['remaining_tokens'])
                    if 'remaining_requests' in trial_validation:
                        headers["X-Trial-Remaining-Requests"] = str(trial_validation['remaining_requests'])
                    if 'remaining_credits' in trial_validation:
                        headers["X-Trial-Remaining-Credits"] = str(trial_validation['remaining_credits'])

                    raise HTTPException(
                        status_code=429,
                        detail=trial_validation['error'],
                        headers=headers
                    )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail=trial_validation.get('error',
                                                    'Access denied. Please start a trial or subscribe to a paid plan.')
                    )

            # Skip rate limiting for trial users - they have their own limits
            if not trial_validation.get('is_trial', False):
                rate_limit_manager = get_rate_limit_manager()
                rate_limit_check = await rate_limit_manager.check_rate_limit(api_key, tokens_used=0)
                if not rate_limit_check.allowed:
                    # Create rate limit alert (async)
                    await loop.run_in_executor(
                        executor,
                        create_rate_limit_alert,
                        api_key,
                        "rate_limit_exceeded",
                        {
                            "reason": rate_limit_check.reason,
                            "retry_after": rate_limit_check.retry_after,
                            "remaining_requests": rate_limit_check.remaining_requests,
                            "remaining_tokens": rate_limit_check.remaining_tokens
                        }
                    )

                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded: {rate_limit_check.reason}",
                        headers={"Retry-After": str(rate_limit_check.retry_after)} if rate_limit_check.retry_after else None
                    )

            if user['credits'] <= 0:
                raise HTTPException(status_code=402, detail="Insufficient credits")

            messages = [msg.model_dump() for msg in req.messages]
            model = req.model

            optional_params = {}
            if req.max_tokens is not None:
                optional_params['max_tokens'] = req.max_tokens
            if req.temperature is not None:
                optional_params['temperature'] = req.temperature
            if req.top_p is not None:
                optional_params['top_p'] = req.top_p
            if req.frequency_penalty is not None:
                optional_params['frequency_penalty'] = req.frequency_penalty
            if req.presence_penalty is not None:
                optional_params['presence_penalty'] = req.presence_penalty

            # Make request to selected provider asynchronously using partial for kwargs
            provider = req.provider if req.provider else "openrouter"

            if provider == "portkey":
                # Use Portkey with specified sub-provider
                portkey_provider = req.portkey_provider if req.portkey_provider else "openai"
                portkey_virtual_key = req.portkey_virtual_key if hasattr(req, 'portkey_virtual_key') else None
                make_request_func = partial(make_portkey_request_openai, messages, model, portkey_provider, portkey_virtual_key, **optional_params)
                response = await loop.run_in_executor(executor, make_request_func)
                processed_response = await loop.run_in_executor(executor, process_portkey_response, response)
            else:
                # Use OpenRouter (default)
                make_request_func = partial(make_openrouter_request_openai, messages, model, **optional_params)
                response = await loop.run_in_executor(executor, make_request_func)
                processed_response = await loop.run_in_executor(executor, process_openrouter_response, response)

            usage = processed_response.get('usage', {})
            total_tokens = usage.get('total_tokens', 0)

            # Check plan limits with actual token usage (async)
            plan_check_final = await loop.run_in_executor(
                executor,
                enforce_plan_limits,
                user['id'],
                total_tokens,
                environment_tag
            )
            if not plan_check_final['allowed']:
                raise HTTPException(
                    status_code=429,
                    detail=f"Plan limit exceeded: {plan_check_final['reason']}"
                )

            # Track trial usage BEFORE generating a response
            if trial_validation.get('is_trial') and not trial_validation.get('is_expired'):
                try:
                    logger.info(f"Tracking trial usage: {total_tokens} tokens, 1 request")
                    success = await loop.run_in_executor(
                        executor,
                        track_trial_usage,
                        api_key,
                        total_tokens,
                        1
                    )
                    if success:
                        logger.info("Trial usage tracked successfully")
                    else:
                        logger.warning("Failed to track trial usage")
                except Exception as e:
                    logger.warning(f"Failed to track trial usage: {e}")

            # Final rate limit check with actual token usage
            # Skip final rate limiting for trial users - they have their own limits
            if not trial_validation.get('is_trial', False):
                rate_limit_check_final = await rate_limit_manager.check_rate_limit(api_key, tokens_used=total_tokens)
                if not rate_limit_check_final.allowed:
                    # Create rate limit alert (async)
                    await loop.run_in_executor(
                        executor,
                        create_rate_limit_alert,
                        api_key,
                        "rate_limit_exceeded",
                        {
                            "reason": rate_limit_check_final.reason,
                            "retry_after": rate_limit_check_final.retry_after,
                            "remaining_requests": rate_limit_check_final.remaining_requests,
                            "remaining_tokens": rate_limit_check_final.remaining_tokens,
                            "tokens_requested": total_tokens
                        }
                    )

                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded: {rate_limit_check_final.reason}",
                        headers={"Retry-After": str(
                            rate_limit_check_final.retry_after)} if rate_limit_check_final.retry_after else None
                    )

            # Only check user credits for non-trial users
            if not trial_validation.get('is_trial', False):
                if user['credits'] < total_tokens:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Insufficient credits. Required: {total_tokens}, Available: {user['credits']}"
                    )

            try:
                # Only deduct credits for non-trial users (use same executor)
                if not trial_validation.get('is_trial', False):
                    await loop.run_in_executor(executor, deduct_credits, api_key, total_tokens)
                    cost = total_tokens * 0.02 / 1000
                    await loop.run_in_executor(executor, record_usage, user['id'], api_key, req.model, total_tokens, cost)
                await loop.run_in_executor(executor, update_rate_limit_usage, api_key, total_tokens)

                # Increment API key usage count
                await loop.run_in_executor(executor, increment_api_key_usage, api_key)

            except ValueError as e:
                logger.error(f"Failed to deduct credits: {e}")
            except Exception as e:
                logger.error(f"Error in usage recording process: {e}")

            # Calculate balance after usage
            if trial_validation.get('is_trial', False):
                # For trial users, show trial credits remaining
                trial_remaining_credits = trial_validation.get('remaining_credits', 0.0)
                processed_response['gateway_usage'] = {
                    'tokens_charged': total_tokens,
                    'trial_credits_remaining': trial_remaining_credits,
                    'user_api_key': f"{api_key[:10]}..."
                }
            else:
                # For non-trial users, show user credits remaining
                processed_response['gateway_usage'] = {
                    'tokens_charged': total_tokens,
                    'user_balance_after': user['credits'] - total_tokens,
                    'user_api_key': f"{api_key[:10]}..."
                }

            # Save chat history if session_id is provided
            if session_id:
                try:
                    # Verify session belongs to user
                    session = await loop.run_in_executor(executor, get_chat_session, session_id, user['id'])
                    if session:
                        # Save user message
                        user_message = messages[0] if messages else None
                        if user_message and user_message.get('role') == 'user':
                            await loop.run_in_executor(
                                executor,
                                save_chat_message,
                                session_id,
                                'user',
                                user_message.get('content', ''),
                                req.model,
                                0  # User message tokens not counted
                            )
                        
                        # Save assistant response
                        assistant_content = processed_response.get('choices', [{}])[0].get('message', {}).get('content', '')
                        if assistant_content:
                            await loop.run_in_executor(
                                executor,
                                save_chat_message,
                                session_id,
                                'assistant',
                                assistant_content,
                                req.model,
                                total_tokens
                            )
                        
                        logger.info(f"Saved chat history to session {session_id}")
                    else:
                        logger.warning(f"Session {session_id} not found for user {user['id']}")
                except Exception as e:
                    logger.error(f"Failed to save chat history: {e}")
                    # Don't fail the request if chat history saving fails
            
            return processed_response

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter HTTP error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 429:
                raise HTTPException(status_code=429, detail="OpenRouter rate limit exceeded")
            elif e.response.status_code == 401:
                raise HTTPException(status_code=500, detail="OpenRouter authentication error")
            elif e.response.status_code == 400:
                raise HTTPException(status_code=400, detail=f"Invalid request: {e.response.text}")
            else:
                raise HTTPException(status_code=e.response.status_code, detail=f"OpenRouter error: {e.response.text}")

        except httpx.RequestError as e:
            logger.error(f"OpenRouter request error: {e}")
            raise HTTPException(status_code=503, detail=f"OpenRouter service unavailable: {str(e)}")

        finally:
            # Clean up executor
            executor.shutdown(wait=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat completion: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
