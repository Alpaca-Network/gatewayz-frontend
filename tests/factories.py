"""
Test data factories for creating test fixtures easily

Provides factory functions to create realistic test data for:
- Users
- API keys
- Chat completions
- Models
- Payments
- Referrals
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List


class UserFactory:
    """Factory for creating test users"""

    @staticmethod
    def create(
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        email: Optional[str] = None,
        credits: float = 100.0,
        role: str = "user",
        is_admin: bool = False,
        subscription_status: str = "active",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a test user

        Args:
            user_id: User ID (auto-generated if None)
            username: Username (auto-generated if None)
            email: Email (auto-generated if None)
            credits: User credits
            role: User role
            is_admin: Admin status
            subscription_status: Subscription status
            **kwargs: Additional user fields

        Returns:
            User dictionary
        """
        user_id = user_id or str(uuid.uuid4())
        username = username or f"test_user_{uuid.uuid4().hex[:8]}"
        email = email or f"{username}@test.example.com"

        user = {
            "id": user_id,
            "username": username,
            "email": email,
            "credits": credits,
            "role": role,
            "is_admin": is_admin,
            "subscription_status": subscription_status,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        user.update(kwargs)
        return user

    @staticmethod
    def create_admin(**kwargs) -> Dict[str, Any]:
        """Create an admin user"""
        return UserFactory.create(role="admin", is_admin=True, **kwargs)

    @staticmethod
    def create_with_trial(**kwargs) -> Dict[str, Any]:
        """Create a user with trial subscription"""
        return UserFactory.create(
            subscription_status="trial",
            credits=50.0,
            **kwargs
        )

    @staticmethod
    def create_low_balance(**kwargs) -> Dict[str, Any]:
        """Create a user with low balance"""
        return UserFactory.create(credits=0.5, **kwargs)


class ApiKeyFactory:
    """Factory for creating test API keys"""

    @staticmethod
    def create(
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
        key_name: str = "Test API Key",
        environment_tag: str = "test",
        is_active: bool = True,
        is_primary: bool = False,
        scope_permissions: Optional[Dict] = None,
        expiration_date: Optional[str] = None,
        max_requests: Optional[int] = None,
        ip_allowlist: Optional[List[str]] = None,
        domain_referrers: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a test API key

        Args:
            api_key: API key string (auto-generated if None)
            user_id: User ID
            key_name: Key name
            environment_tag: Environment (test, live, staging, development)
            is_active: Active status
            is_primary: Primary key status
            scope_permissions: Permission scopes
            expiration_date: Expiration date
            max_requests: Request limit
            ip_allowlist: Allowed IPs
            domain_referrers: Allowed domains
            **kwargs: Additional fields

        Returns:
            API key dictionary
        """
        api_key = api_key or f"gw_{environment_tag}_{uuid.uuid4().hex[:16]}"
        user_id = user_id or str(uuid.uuid4())

        if scope_permissions is None:
            scope_permissions = {"read": ["*"], "write": ["api_keys"]}

        key_data = {
            "id": kwargs.pop("id", 1),
            "api_key": api_key,
            "user_id": user_id,
            "key_name": key_name,
            "environment_tag": environment_tag,
            "is_active": is_active,
            "is_primary": is_primary,
            "scope_permissions": scope_permissions,
            "expiration_date": expiration_date,
            "max_requests": max_requests,
            "ip_allowlist": ip_allowlist or [],
            "domain_referrers": domain_referrers or [],
            "last_used_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        key_data.update(kwargs)
        return key_data

    @staticmethod
    def create_live(**kwargs) -> Dict[str, Any]:
        """Create a live API key"""
        return ApiKeyFactory.create(environment_tag="live", **kwargs)

    @staticmethod
    def create_expired(**kwargs) -> Dict[str, Any]:
        """Create an expired API key"""
        expiration = (datetime.utcnow() - timedelta(days=1)).isoformat()
        return ApiKeyFactory.create(expiration_date=expiration, **kwargs)

    @staticmethod
    def create_with_ip_restrictions(**kwargs) -> Dict[str, Any]:
        """Create API key with IP restrictions"""
        return ApiKeyFactory.create(
            ip_allowlist=["192.168.1.1", "10.0.0.1"],
            **kwargs
        )


class ChatCompletionFactory:
    """Factory for creating test chat completion requests/responses"""

    @staticmethod
    def create_request(
        model: str = "anthropic/claude-3-opus",
        messages: Optional[List[Dict]] = None,
        stream: bool = False,
        max_tokens: int = 1000,
        temperature: float = 1.0,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a chat completion request

        Args:
            model: Model name
            messages: Chat messages
            stream: Streaming enabled
            max_tokens: Max tokens
            temperature: Temperature
            **kwargs: Additional parameters

        Returns:
            Chat completion request dictionary
        """
        if messages is None:
            messages = [{"role": "user", "content": "Hello"}]

        request = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        request.update(kwargs)
        return request

    @staticmethod
    def create_response(
        model: str = "anthropic/claude-3-opus",
        content: str = "Hello! How can I help you?",
        finish_reason: str = "stop",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a chat completion response

        Args:
            model: Model name
            content: Response content
            finish_reason: Finish reason
            **kwargs: Additional fields

        Returns:
            Chat completion response dictionary
        """
        response = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:16]}",
            "object": "chat.completion",
            "created": int(datetime.utcnow().timestamp()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content,
                    },
                    "finish_reason": finish_reason,
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30,
            },
        }

        response.update(kwargs)
        return response

    @staticmethod
    def create_streaming_chunk(
        content: str = "Hello",
        finish_reason: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a streaming response chunk"""
        chunk = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:16]}",
            "object": "chat.completion.chunk",
            "created": int(datetime.utcnow().timestamp()),
            "model": "anthropic/claude-3-opus",
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": content},
                    "finish_reason": finish_reason,
                }
            ],
        }

        chunk.update(kwargs)
        return chunk


class ModelFactory:
    """Factory for creating test model data"""

    @staticmethod
    def create(
        model_id: str = "anthropic/claude-3-opus",
        provider: str = "anthropic",
        name: str = "Claude 3 Opus",
        context_length: int = 200000,
        input_cost: float = 15.0,
        output_cost: float = 75.0,
        is_available: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a test model

        Args:
            model_id: Model identifier
            provider: Provider name
            name: Display name
            context_length: Context window size
            input_cost: Input cost per 1M tokens
            output_cost: Output cost per 1M tokens
            is_available: Availability status
            **kwargs: Additional fields

        Returns:
            Model dictionary
        """
        model = {
            "id": model_id,
            "provider": provider,
            "name": name,
            "context_length": context_length,
            "pricing": {
                "prompt": input_cost / 1_000_000,
                "completion": output_cost / 1_000_000,
            },
            "is_available": is_available,
            "created_at": datetime.utcnow().isoformat(),
        }

        model.update(kwargs)
        return model

    @staticmethod
    def create_openai(**kwargs) -> Dict[str, Any]:
        """Create an OpenAI model"""
        return ModelFactory.create(
            model_id="gpt-4-turbo",
            provider="openai",
            name="GPT-4 Turbo",
            context_length=128000,
            input_cost=10.0,
            output_cost=30.0,
            **kwargs
        )

    @staticmethod
    def create_unavailable(**kwargs) -> Dict[str, Any]:
        """Create an unavailable model"""
        return ModelFactory.create(is_available=False, **kwargs)


class PaymentFactory:
    """Factory for creating test payment data"""

    @staticmethod
    def create_transaction(
        user_id: Optional[str] = None,
        amount: float = 10.0,
        currency: str = "usd",
        status: str = "succeeded",
        payment_method: str = "card",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a payment transaction

        Args:
            user_id: User ID
            amount: Amount
            currency: Currency code
            status: Payment status
            payment_method: Payment method
            **kwargs: Additional fields

        Returns:
            Payment transaction dictionary
        """
        transaction = {
            "id": f"txn_{uuid.uuid4().hex[:16]}",
            "user_id": user_id or str(uuid.uuid4()),
            "amount": amount,
            "currency": currency,
            "status": status,
            "payment_method": payment_method,
            "created_at": datetime.utcnow().isoformat(),
        }

        transaction.update(kwargs)
        return transaction

    @staticmethod
    def create_failed(**kwargs) -> Dict[str, Any]:
        """Create a failed payment"""
        return PaymentFactory.create_transaction(status="failed", **kwargs)


class ReferralFactory:
    """Factory for creating test referral data"""

    @staticmethod
    def create(
        referrer_id: Optional[str] = None,
        referee_id: Optional[str] = None,
        referral_code: Optional[str] = None,
        reward_amount: float = 5.0,
        status: str = "pending",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a referral

        Args:
            referrer_id: Referrer user ID
            referee_id: Referee user ID
            referral_code: Referral code
            reward_amount: Reward amount
            status: Referral status
            **kwargs: Additional fields

        Returns:
            Referral dictionary
        """
        referral = {
            "id": kwargs.pop("id", 1),
            "referrer_id": referrer_id or str(uuid.uuid4()),
            "referee_id": referee_id or str(uuid.uuid4()),
            "referral_code": referral_code or f"REF{uuid.uuid4().hex[:8].upper()}",
            "reward_amount": reward_amount,
            "status": status,
            "created_at": datetime.utcnow().isoformat(),
        }

        referral.update(kwargs)
        return referral

    @staticmethod
    def create_completed(**kwargs) -> Dict[str, Any]:
        """Create a completed referral"""
        return ReferralFactory.create(status="completed", **kwargs)
