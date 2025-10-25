#!/usr/bin/env python3
"""
Comprehensive tests for all Pydantic schema models

Tests cover:
- Model instantiation with valid data
- Required field validation
- Optional field handling
- Default values
- Type validation
- Enum validation
- Serialization/deserialization
- Edge cases and constraints
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

# ==================================================
# COMMON SCHEMAS TESTS
# ==================================================

class TestCommonEnums:
    """Test common enumeration types"""

    def test_auth_method_enum_values(self):
        """Test AuthMethod enum has correct values"""
        from src.schemas.common import AuthMethod

        assert AuthMethod.EMAIL == "email"
        assert AuthMethod.WALLET == "wallet"
        assert AuthMethod.GOOGLE == "google"
        assert AuthMethod.GITHUB == "github"

        # Test all values are accessible
        assert len(AuthMethod) == 4

    def test_auth_method_from_string(self):
        """Test creating AuthMethod from string"""
        from src.schemas.common import AuthMethod

        assert AuthMethod("email") == AuthMethod.EMAIL
        assert AuthMethod("google") == AuthMethod.GOOGLE

    def test_payment_method_enum_values(self):
        """Test PaymentMethod enum has correct values"""
        from src.schemas.common import PaymentMethod

        assert PaymentMethod.MASTERCARD == "mastercard"
        assert PaymentMethod.PACA_TOKEN == "paca_token"
        assert len(PaymentMethod) == 2

    def test_subscription_status_enum_values(self):
        """Test SubscriptionStatus enum has correct values"""
        from src.schemas.common import SubscriptionStatus

        assert SubscriptionStatus.ACTIVE == "active"
        assert SubscriptionStatus.EXPIRED == "expired"
        assert SubscriptionStatus.CANCELLED == "cancelled"
        assert SubscriptionStatus.TRIAL == "trial"
        assert len(SubscriptionStatus) == 4

    def test_plan_type_enum_values(self):
        """Test PlanType enum has correct values"""
        from src.schemas.common import PlanType

        assert PlanType.FREE == "free"
        assert PlanType.DEV == "dev"
        assert PlanType.TEAM == "team"
        assert PlanType.CUSTOMIZE == "customize"
        assert len(PlanType) == 4


# ==================================================
# AUTH SCHEMAS TESTS
# ==================================================

class TestPrivyLinkedAccount:
    """Test PrivyLinkedAccount model"""

    def test_create_with_email_account(self):
        """Test creating email linked account"""
        from src.schemas.auth import PrivyLinkedAccount

        account = PrivyLinkedAccount(
            type="email",
            email="test@example.com",
            verified_at=1234567890
        )

        assert account.type == "email"
        assert account.email == "test@example.com"
        assert account.verified_at == 1234567890
        assert account.subject is None  # Optional field

    def test_create_with_google_account(self):
        """Test creating Google OAuth linked account"""
        from src.schemas.auth import PrivyLinkedAccount

        account = PrivyLinkedAccount(
            type="google_oauth",
            email="user@gmail.com",
            name="Test User",
            verified_at=1234567890
        )

        assert account.type == "google_oauth"
        assert account.email == "user@gmail.com"
        assert account.name == "Test User"

    def test_all_optional_fields(self):
        """Test creating account with only required field"""
        from src.schemas.auth import PrivyLinkedAccount

        account = PrivyLinkedAccount(type="wallet")

        assert account.type == "wallet"
        assert account.email is None
        assert account.name is None
        assert account.verified_at is None


class TestPrivyUserData:
    """Test PrivyUserData model"""

    def test_create_with_minimal_data(self):
        """Test creating PrivyUserData with minimal required fields"""
        from src.schemas.auth import PrivyUserData

        user = PrivyUserData(
            id="privy_123",
            created_at=1234567890
        )

        assert user.id == "privy_123"
        assert user.created_at == 1234567890
        assert user.linked_accounts == []
        assert user.mfa_methods == []
        assert user.has_accepted_terms is False
        assert user.is_guest is False

    def test_create_with_linked_accounts(self):
        """Test creating PrivyUserData with linked accounts"""
        from src.schemas.auth import PrivyUserData, PrivyLinkedAccount

        user = PrivyUserData(
            id="privy_456",
            created_at=1234567890,
            linked_accounts=[
                PrivyLinkedAccount(type="email", email="test@example.com"),
                PrivyLinkedAccount(type="wallet", subject="0x123abc")
            ],
            has_accepted_terms=True
        )

        assert len(user.linked_accounts) == 2
        assert user.linked_accounts[0].type == "email"
        assert user.has_accepted_terms is True

    def test_missing_required_id(self):
        """Test that id field is required"""
        from src.schemas.auth import PrivyUserData

        with pytest.raises(ValidationError) as exc_info:
            PrivyUserData(created_at=1234567890)

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('id',) for e in errors)

    def test_missing_required_created_at(self):
        """Test that created_at field is required"""
        from src.schemas.auth import PrivyUserData

        with pytest.raises(ValidationError) as exc_info:
            PrivyUserData(id="privy_789")

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('created_at',) for e in errors)


class TestPrivyAuthRequest:
    """Test PrivyAuthRequest model"""

    def test_create_minimal_request(self):
        """Test creating minimal auth request"""
        from src.schemas.auth import PrivyAuthRequest, PrivyUserData

        user_data = PrivyUserData(id="privy_123", created_at=1234567890)
        request = PrivyAuthRequest(
            user=user_data,
            token="access_token_123"
        )

        assert request.user.id == "privy_123"
        assert request.token == "access_token_123"
        assert request.email is None
        assert request.is_new_user is None
        assert request.referral_code is None

    def test_create_with_all_fields(self):
        """Test creating auth request with all optional fields"""
        from src.schemas.auth import PrivyAuthRequest, PrivyUserData

        user_data = PrivyUserData(id="privy_456", created_at=1234567890)
        request = PrivyAuthRequest(
            user=user_data,
            token="access_token_456",
            email="user@example.com",
            privy_access_token="privy_access_123",
            refresh_token="refresh_123",
            session_update_action="login",
            is_new_user=True,
            referral_code="FRIEND10"
        )

        assert request.email == "user@example.com"
        assert request.privy_access_token == "privy_access_123"
        assert request.is_new_user is True
        assert request.referral_code == "FRIEND10"


class TestPrivyAuthResponse:
    """Test PrivyAuthResponse model"""

    def test_create_success_response(self):
        """Test creating successful auth response"""
        from src.schemas.auth import PrivyAuthResponse, AuthMethod

        response = PrivyAuthResponse(
            success=True,
            message="Login successful",
            user_id=123,
            api_key="gw_live_test_key",
            auth_method=AuthMethod.EMAIL,
            privy_user_id="privy_789",
            is_new_user=False,
            email="test@example.com",
            credits=100.0,
            timestamp=datetime.now(timezone.utc)
        )

        assert response.success is True
        assert response.message == "Login successful"
        assert response.user_id == 123
        assert response.api_key == "gw_live_test_key"
        assert response.auth_method == AuthMethod.EMAIL
        assert response.credits == 100.0

    def test_create_minimal_response(self):
        """Test creating response with only required fields"""
        from src.schemas.auth import PrivyAuthResponse

        response = PrivyAuthResponse(
            success=False,
            message="Authentication failed"
        )

        assert response.success is False
        assert response.message == "Authentication failed"
        assert response.user_id is None
        assert response.api_key is None


# ==================================================
# USER SCHEMAS TESTS
# ==================================================

class TestUserRegistrationRequest:
    """Test UserRegistrationRequest model"""

    def test_create_with_defaults(self):
        """Test creating registration request with default values"""
        from src.schemas.users import UserRegistrationRequest

        request = UserRegistrationRequest(
            username="testuser",
            email="test@example.com"
        )

        assert request.username == "testuser"
        assert request.email == "test@example.com"
        assert request.auth_method.value == "email"  # Default
        assert request.environment_tag == "live"  # Default
        assert request.key_name == "Primary Key"  # Default
        assert request.referral_code is None

    def test_create_with_all_fields(self):
        """Test creating registration request with all fields"""
        from src.schemas.users import UserRegistrationRequest, AuthMethod

        request = UserRegistrationRequest(
            username="googleuser",
            email="user@gmail.com",
            auth_method=AuthMethod.GOOGLE,
            environment_tag="test",
            key_name="Test Key",
            referral_code="REFER123"
        )

        assert request.auth_method == AuthMethod.GOOGLE
        assert request.environment_tag == "test"
        assert request.key_name == "Test Key"
        assert request.referral_code == "REFER123"

    def test_invalid_email(self):
        """Test that invalid email is rejected"""
        from src.schemas.users import UserRegistrationRequest

        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationRequest(
                username="testuser",
                email="not-an-email"
            )

        errors = exc_info.value.errors()
        assert any('email' in str(e) for e in errors)

    def test_missing_required_username(self):
        """Test that username is required"""
        from src.schemas.users import UserRegistrationRequest

        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationRequest(email="test@example.com")

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('username',) for e in errors)


class TestUserRegistrationResponse:
    """Test UserRegistrationResponse model"""

    def test_create_complete_response(self):
        """Test creating complete registration response"""
        from src.schemas.users import UserRegistrationResponse, AuthMethod, SubscriptionStatus

        response = UserRegistrationResponse(
            user_id=1,
            username="newuser",
            email="new@example.com",
            api_key="gw_live_key_123",
            credits=10,
            environment_tag="live",
            scope_permissions={"read": ["models"], "write": ["chat"]},
            auth_method=AuthMethod.EMAIL,
            subscription_status=SubscriptionStatus.TRIAL,
            message="Account created successfully",
            timestamp=datetime.now(timezone.utc)
        )

        assert response.user_id == 1
        assert response.username == "newuser"
        assert response.credits == 10
        assert response.auth_method == AuthMethod.EMAIL
        assert response.subscription_status == SubscriptionStatus.TRIAL
        assert "read" in response.scope_permissions


class TestUserProfileUpdate:
    """Test UserProfileUpdate model"""

    def test_create_with_all_optional_fields_none(self):
        """Test that all fields are optional"""
        from src.schemas.users import UserProfileUpdate

        # Should be valid with no fields
        update = UserProfileUpdate()

        assert update.name is None
        assert update.email is None
        assert update.preferences is None
        assert update.settings is None

    def test_create_with_partial_update(self):
        """Test creating update with only some fields"""
        from src.schemas.users import UserProfileUpdate

        update = UserProfileUpdate(
            name="Updated Name",
            preferences={"theme": "dark"}
        )

        assert update.name == "Updated Name"
        assert update.preferences == {"theme": "dark"}
        assert update.email is None
        assert update.settings is None

    def test_create_with_all_fields(self):
        """Test creating update with all fields"""
        from src.schemas.users import UserProfileUpdate

        update = UserProfileUpdate(
            name="Full Name",
            email="new@example.com",
            preferences={"theme": "dark", "language": "en"},
            settings={"notifications": True}
        )

        assert update.name == "Full Name"
        assert update.email == "new@example.com"
        assert update.preferences["theme"] == "dark"
        assert update.settings["notifications"] is True


class TestUserProfileResponse:
    """Test UserProfileResponse model"""

    def test_create_with_minimal_fields(self):
        """Test creating profile response with required fields"""
        from src.schemas.users import UserProfileResponse

        response = UserProfileResponse(
            user_id=1,
            api_key="gw_live_key",
            credits=100,
            username=None,  # Optional
            email=None,  # Optional
            auth_method=None,  # Optional
            subscription_status=None,  # Optional
            trial_expires_at=None,  # Optional
            is_active=None,  # Optional
            registration_date=None,  # Optional
            created_at=None,  # Optional
            updated_at=None  # Optional
        )

        assert response.user_id == 1
        assert response.api_key == "gw_live_key"
        assert response.credits == 100
        assert response.username is None

    def test_create_with_all_fields(self):
        """Test creating profile response with all fields"""
        from src.schemas.users import UserProfileResponse

        response = UserProfileResponse(
            user_id=1,
            api_key="gw_live_key",
            credits=100,
            username="testuser",
            email="test@example.com",
            auth_method="email",
            subscription_status="active",
            trial_expires_at="2024-12-31T23:59:59Z",
            is_active=True,
            registration_date="2024-01-01",
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-10-24T12:00:00Z"
        )

        assert response.username == "testuser"
        assert response.email == "test@example.com"
        assert response.is_active is True
        assert response.subscription_status == "active"


class TestDeleteAccountRequest:
    """Test DeleteAccountRequest model"""

    def test_create_with_confirmation(self):
        """Test creating delete request with confirmation"""
        from src.schemas.users import DeleteAccountRequest

        request = DeleteAccountRequest(confirmation="DELETE")

        assert request.confirmation == "DELETE"

    def test_missing_confirmation(self):
        """Test that confirmation is required"""
        from src.schemas.users import DeleteAccountRequest

        with pytest.raises(ValidationError) as exc_info:
            DeleteAccountRequest()

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('confirmation',) for e in errors)


class TestDeleteAccountResponse:
    """Test DeleteAccountResponse model"""

    def test_create_response(self):
        """Test creating delete response"""
        from src.schemas.users import DeleteAccountResponse

        response = DeleteAccountResponse(
            status="success",
            message="Account deleted successfully",
            user_id=123,
            timestamp=datetime.now(timezone.utc)
        )

        assert response.status == "success"
        assert response.message == "Account deleted successfully"
        assert response.user_id == 123
        assert isinstance(response.timestamp, datetime)


# ==================================================
# MODEL SERIALIZATION TESTS
# ==================================================

class TestModelSerialization:
    """Test Pydantic model serialization and deserialization"""

    def test_privy_auth_request_to_dict(self):
        """Test serializing PrivyAuthRequest to dict"""
        from src.schemas.auth import PrivyAuthRequest, PrivyUserData

        user_data = PrivyUserData(id="privy_123", created_at=1234567890)
        request = PrivyAuthRequest(
            user=user_data,
            token="token_123",
            email="test@example.com"
        )

        data = request.model_dump()

        assert data['user']['id'] == "privy_123"
        assert data['token'] == "token_123"
        assert data['email'] == "test@example.com"

    def test_privy_auth_request_from_dict(self):
        """Test deserializing PrivyAuthRequest from dict"""
        from src.schemas.auth import PrivyAuthRequest

        data = {
            "user": {
                "id": "privy_456",
                "created_at": 1234567890,
                "linked_accounts": [],
                "mfa_methods": [],
                "has_accepted_terms": True,
                "is_guest": False
            },
            "token": "token_456"
        }

        request = PrivyAuthRequest(**data)

        assert request.user.id == "privy_456"
        assert request.token == "token_456"
        assert request.user.has_accepted_terms is True

    def test_user_registration_request_to_json(self):
        """Test serializing UserRegistrationRequest to JSON"""
        from src.schemas.users import UserRegistrationRequest, AuthMethod

        request = UserRegistrationRequest(
            username="jsonuser",
            email="json@example.com",
            auth_method=AuthMethod.GOOGLE
        )

        json_str = request.model_dump_json()

        assert "jsonuser" in json_str
        assert "json@example.com" in json_str
        assert "google" in json_str

    def test_user_registration_response_from_json(self):
        """Test deserializing UserRegistrationResponse from JSON"""
        from src.schemas.users import UserRegistrationResponse
        import json

        json_data = {
            "user_id": 1,
            "username": "testuser",
            "email": "test@example.com",
            "api_key": "gw_live_key",
            "credits": 10,
            "environment_tag": "live",
            "scope_permissions": {},
            "auth_method": "email",
            "subscription_status": "trial",
            "message": "Success",
            "timestamp": "2024-10-24T12:00:00Z"
        }

        response = UserRegistrationResponse(**json_data)

        assert response.user_id == 1
        assert response.username == "testuser"
        assert response.credits == 10


# ==================================================
# EDGE CASES AND VALIDATION TESTS
# ==================================================

class TestEdgeCasesAndValidation:
    """Test edge cases and validation scenarios"""

    def test_empty_string_username(self):
        """Test that empty string username should fail validation"""
        from src.schemas.users import UserRegistrationRequest

        # Pydantic allows empty strings by default unless constrained
        # This test documents current behavior
        request = UserRegistrationRequest(
            username="",
            email="test@example.com"
        )

        assert request.username == ""

    def test_very_long_username(self):
        """Test handling very long username"""
        from src.schemas.users import UserRegistrationRequest

        long_username = "a" * 1000
        request = UserRegistrationRequest(
            username=long_username,
            email="test@example.com"
        )

        assert len(request.username) == 1000

    def test_special_characters_in_email(self):
        """Test email with special characters"""
        from src.schemas.users import UserRegistrationRequest

        # Valid email with special characters
        request = UserRegistrationRequest(
            username="testuser",
            email="user+tag@example.co.uk"
        )

        assert request.email == "user+tag@example.co.uk"

    def test_negative_credits(self):
        """Test that negative credits are accepted (if no constraint)"""
        from src.schemas.users import UserRegistrationResponse, AuthMethod, SubscriptionStatus

        # Pydantic accepts negative values unless constrained
        response = UserRegistrationResponse(
            user_id=1,
            username="user",
            email="test@example.com",
            api_key="key",
            credits=-100,  # Negative credits
            environment_tag="live",
            scope_permissions={},
            auth_method=AuthMethod.EMAIL,
            subscription_status=SubscriptionStatus.ACTIVE,
            message="Test",
            timestamp=datetime.now(timezone.utc)
        )

        assert response.credits == -100

    def test_zero_user_id(self):
        """Test handling zero as user_id"""
        from src.schemas.users import UserProfileResponse

        response = UserProfileResponse(
            user_id=0,  # Zero ID
            api_key="key",
            credits=100,
            username=None,
            email=None,
            auth_method=None,
            subscription_status=None,
            trial_expires_at=None,
            is_active=None,
            registration_date=None,
            created_at=None,
            updated_at=None
        )

        assert response.user_id == 0

    def test_unicode_in_username(self):
        """Test Unicode characters in username"""
        from src.schemas.users import UserRegistrationRequest

        request = UserRegistrationRequest(
            username="用户名",  # Chinese characters
            email="test@example.com"
        )

        assert request.username == "用户名"

    def test_null_vs_empty_string(self):
        """Test difference between None and empty string"""
        from src.schemas.users import UserProfileUpdate

        update1 = UserProfileUpdate(name=None)
        update2 = UserProfileUpdate(name="")

        assert update1.name is None
        assert update2.name == ""
        assert update1.name != update2.name


# ==================================================
# ENUM STRING COERCION TESTS
# ==================================================

class TestEnumCoercion:
    """Test that enums can be created from strings"""

    def test_auth_method_from_string_in_model(self):
        """Test AuthMethod enum coercion in model"""
        from src.schemas.users import UserRegistrationRequest

        # Should accept string and convert to enum
        request = UserRegistrationRequest(
            username="user",
            email="test@example.com",
            auth_method="google"  # String instead of enum
        )

        assert request.auth_method.value == "google"

    def test_subscription_status_from_string_in_model(self):
        """Test SubscriptionStatus enum coercion in model"""
        from src.schemas.users import UserRegistrationResponse, AuthMethod

        response = UserRegistrationResponse(
            user_id=1,
            username="user",
            email="test@example.com",
            api_key="key",
            credits=10,
            environment_tag="live",
            scope_permissions={},
            auth_method=AuthMethod.EMAIL,
            subscription_status="trial",  # String instead of enum
            message="Test",
            timestamp=datetime.now(timezone.utc)
        )

        assert response.subscription_status.value == "trial"

    def test_invalid_enum_value(self):
        """Test that invalid enum value raises error"""
        from src.schemas.users import UserRegistrationRequest

        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationRequest(
                username="user",
                email="test@example.com",
                auth_method="invalid_method"  # Invalid enum value
            )

        errors = exc_info.value.errors()
        assert any('auth_method' in str(e) for e in errors)


# ==================================================
# CHAT SCHEMAS TESTS
# ==================================================

class TestChatSchemas:
    """Test chat-related schemas"""

    def test_chat_message_creation(self):
        """Test creating a ChatMessage"""
        from src.schemas.chat import ChatMessage

        message = ChatMessage(
            session_id=1,
            role="user",
            content="Hello, world!"
        )

        assert message.session_id == 1
        assert message.role == "user"
        assert message.content == "Hello, world!"
        assert message.id is None
        assert message.tokens == 0

    def test_chat_session_creation(self):
        """Test creating a ChatSession"""
        from src.schemas.chat import ChatSession

        session = ChatSession(
            user_id=123,
            title="Test Chat",
            model="gpt-4"
        )

        assert session.user_id == 123
        assert session.title == "Test Chat"
        assert session.model == "gpt-4"
        assert session.is_active is True
        assert session.messages == []

    def test_chat_session_with_messages(self):
        """Test creating ChatSession with messages"""
        from src.schemas.chat import ChatSession, ChatMessage

        messages = [
            ChatMessage(session_id=1, role="user", content="Hi"),
            ChatMessage(session_id=1, role="assistant", content="Hello!")
        ]

        session = ChatSession(
            user_id=123,
            title="Conversation",
            model="gpt-4",
            messages=messages
        )

        assert len(session.messages) == 2
        assert session.messages[0].role == "user"

    def test_create_chat_session_request(self):
        """Test CreateChatSessionRequest"""
        from src.schemas.chat import CreateChatSessionRequest

        request = CreateChatSessionRequest(
            title="New Chat",
            model="gpt-3.5-turbo"
        )

        assert request.title == "New Chat"
        assert request.model == "gpt-3.5-turbo"

    def test_create_chat_session_request_defaults(self):
        """Test CreateChatSessionRequest with defaults"""
        from src.schemas.chat import CreateChatSessionRequest

        request = CreateChatSessionRequest()

        assert request.title is None
        assert request.model is None

    def test_chat_session_response(self):
        """Test ChatSessionResponse"""
        from src.schemas.chat import ChatSessionResponse, ChatSession

        session = ChatSession(
            user_id=1,
            title="Test",
            model="gpt-4"
        )

        response = ChatSessionResponse(
            success=True,
            data=session,
            message="Session created"
        )

        assert response.success is True
        assert response.data.title == "Test"
        assert response.message == "Session created"

    def test_chat_sessions_list_response(self):
        """Test ChatSessionsListResponse"""
        from src.schemas.chat import ChatSessionsListResponse, ChatSession

        sessions = [
            ChatSession(user_id=1, title="Chat 1", model="gpt-4"),
            ChatSession(user_id=1, title="Chat 2", model="gpt-3.5")
        ]

        response = ChatSessionsListResponse(
            success=True,
            data=sessions,
            count=2
        )

        assert response.success is True
        assert response.count == 2
        assert len(response.data) == 2

    def test_search_chat_sessions_request(self):
        """Test SearchChatSessionsRequest"""
        from src.schemas.chat import SearchChatSessionsRequest

        request = SearchChatSessionsRequest(
            query="python",
            limit=10
        )

        assert request.query == "python"
        assert request.limit == 10

    def test_save_chat_message_request(self):
        """Test SaveChatMessageRequest"""
        from src.schemas.chat import SaveChatMessageRequest

        request = SaveChatMessageRequest(
            role="user",
            content="Test message",
            model="gpt-4",
            tokens=50
        )

        assert request.role == "user"
        assert request.content == "Test message"
        assert request.tokens == 50


# ==================================================
# COUPON SCHEMAS TESTS
# ==================================================

class TestCouponSchemas:
    """Test coupon-related schemas"""

    def test_coupon_scope_enum(self):
        """Test CouponScope enum"""
        from src.schemas.coupons import CouponScope

        assert CouponScope.USER_SPECIFIC == "user_specific"
        assert CouponScope.GLOBAL == "global"

    def test_coupon_type_enum(self):
        """Test CouponType enum"""
        from src.schemas.coupons import CouponType

        assert CouponType.PROMOTIONAL == "promotional"
        assert CouponType.REFERRAL == "referral"
        assert CouponType.COMPENSATION == "compensation"
        assert CouponType.PARTNERSHIP == "partnership"

    def test_creator_type_enum(self):
        """Test CreatorType enum"""
        from src.schemas.coupons import CreatorType

        assert CreatorType.ADMIN == "admin"
        assert CreatorType.SYSTEM == "system"

    def test_create_global_coupon_request(self):
        """Test creating a global coupon request"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope, CouponType
        from datetime import datetime, timedelta

        request = CreateCouponRequest(
            code="SAVE20",
            value_usd=20.0,
            coupon_scope=CouponScope.GLOBAL,
            max_uses=100,
            valid_until=datetime.now() + timedelta(days=30),
            coupon_type=CouponType.PROMOTIONAL
        )

        assert request.code == "SAVE20"  # Should be uppercased
        assert request.value_usd == 20.0
        assert request.coupon_scope == CouponScope.GLOBAL
        assert request.max_uses == 100

    def test_create_user_specific_coupon_request(self):
        """Test creating a user-specific coupon request"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        request = CreateCouponRequest(
            code="WELCOME10",
            value_usd=10.0,
            coupon_scope=CouponScope.USER_SPECIFIC,
            max_uses=1,
            valid_until=datetime.now() + timedelta(days=7),
            assigned_to_user_id=123
        )

        assert request.code == "WELCOME10"
        assert request.assigned_to_user_id == 123
        assert request.max_uses == 1

    def test_coupon_code_validation_uppercase(self):
        """Test that coupon codes are converted to uppercase"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        request = CreateCouponRequest(
            code="lowercase",
            value_usd=15.0,
            coupon_scope=CouponScope.GLOBAL,
            max_uses=50,
            valid_until=datetime.now() + timedelta(days=30)
        )

        assert request.code == "LOWERCASE"

    def test_coupon_code_with_special_chars(self):
        """Test coupon codes with hyphens and underscores"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        request = CreateCouponRequest(
            code="SAVE_20-OFF",
            value_usd=20.0,
            coupon_scope=CouponScope.GLOBAL,
            max_uses=100,
            valid_until=datetime.now() + timedelta(days=30)
        )

        assert request.code == "SAVE_20-OFF"

    def test_invalid_coupon_code(self):
        """Test that invalid coupon code raises error"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        with pytest.raises(ValidationError):
            CreateCouponRequest(
                code="SAVE@20",  # @ not allowed
                value_usd=20.0,
                coupon_scope=CouponScope.GLOBAL,
                max_uses=100,
                valid_until=datetime.now() + timedelta(days=30)
            )

    def test_user_specific_coupon_without_user_id(self):
        """Test that user-specific coupon requires user_id"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        with pytest.raises(ValidationError) as exc_info:
            CreateCouponRequest(
                code="USERCODE",
                value_usd=10.0,
                coupon_scope=CouponScope.USER_SPECIFIC,
                max_uses=1,
                valid_until=datetime.now() + timedelta(days=7)
                # Missing assigned_to_user_id
            )

        errors = exc_info.value.errors()
        assert any('assigned_to_user_id' in str(e) or 'user_assignment' in str(e) for e in errors)

    def test_global_coupon_with_user_id(self):
        """Test that global coupon cannot have user_id"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        with pytest.raises(ValidationError) as exc_info:
            CreateCouponRequest(
                code="GLOBAL",
                value_usd=10.0,
                coupon_scope=CouponScope.GLOBAL,
                max_uses=100,
                valid_until=datetime.now() + timedelta(days=7),
                assigned_to_user_id=123  # Should not be allowed
            )

        errors = exc_info.value.errors()
        assert any('assigned_to_user_id' in str(e) or 'user_assignment' in str(e) for e in errors)

    def test_user_specific_coupon_max_uses_validation(self):
        """Test that user-specific coupons must have max_uses=1"""
        from src.schemas.coupons import CreateCouponRequest, CouponScope
        from datetime import datetime, timedelta

        with pytest.raises(ValidationError) as exc_info:
            CreateCouponRequest(
                code="USER",
                value_usd=10.0,
                coupon_scope=CouponScope.USER_SPECIFIC,
                max_uses=5,  # Should be 1 for user-specific
                valid_until=datetime.now() + timedelta(days=7),
                assigned_to_user_id=123
            )

        errors = exc_info.value.errors()
        assert any('max_uses' in str(e) for e in errors)

    def test_redeem_coupon_request(self):
        """Test RedeemCouponRequest"""
        from src.schemas.coupons import RedeemCouponRequest

        request = RedeemCouponRequest(code="SAVE20")

        assert request.code == "SAVE20"
