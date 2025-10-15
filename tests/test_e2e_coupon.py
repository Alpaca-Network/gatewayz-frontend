"""
E2E Tests for Coupon Feature
Tests all coupon endpoints with real database interactions
"""
import os
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def test_api_keys(supabase_client, test_prefix):
    """Create test users with API keys"""
    created_users = []
    created_keys = []

    def _create_test_user(credits=100.0, username_suffix="user"):
        """Create a test user and return user data with API key"""
        username = f"{test_prefix}_coupon_{username_suffix}"
        email = f"{username}@test.example.com"

        # Create user
        user_data = {
            "username": username,
            "email": email,
            "credits": credits,
            "created_at": datetime.utcnow().isoformat(),
        }

        user_result = supabase_client.table("users").insert(user_data).execute()

        if not user_result.data:
            raise Exception("Failed to create test user")

        user = user_result.data[0]
        created_users.append(user['id'])

        # Create API key
        api_key = f"sk-test-{test_prefix}-{username_suffix}"
        key_data = {
            "user_id": user['id'],
            "api_key": api_key,
            "key_name": f"Test Key {username_suffix}",
            "is_primary": True,
            "is_active": True,
            "environment_tag": "test",
            "scope_permissions": ["chat", "images"],
            "created_at": datetime.utcnow().isoformat(),
        }

        key_result = supabase_client.table("api_keys_new").insert(key_data).execute()

        if key_result.data:
            created_keys.append(key_result.data[0]['id'])

        return {
            "user_id": user['id'],
            "api_key": api_key,
            "username": username,
            "email": email,
            "credits": credits
        }

    yield _create_test_user

    # Cleanup
    try:
        if created_keys:
            supabase_client.table("api_keys_new").delete().in_("id", created_keys).execute()

        if created_users:
            # Clean up coupon redemptions first
            supabase_client.table("coupon_redemptions").delete().in_("user_id", created_users).execute()
            # Clean up users
            supabase_client.table("users").delete().in_("id", created_users).execute()
    except Exception as e:
        print(f"Cleanup error: {e}")


@pytest.fixture
def admin_api_key(supabase_client, test_prefix):
    """Create an admin user with API key for testing"""
    admin_username = f"{test_prefix}_admin_user"
    admin_email = f"{admin_username}@test.example.com"
    admin_api_key_value = f"sk-admin-{test_prefix}"

    # Create admin user
    admin_user_data = {
        "username": admin_username,
        "email": admin_email,
        "credits": 1000,
        "role": "admin",
        "created_at": datetime.utcnow().isoformat(),
    }

    admin_user_result = supabase_client.table("users").insert(admin_user_data).execute()

    if not admin_user_result.data:
        raise Exception("Failed to create admin user")

    admin_user = admin_user_result.data[0]
    admin_user_id = admin_user['id']

    # Create API key for admin
    admin_key_data = {
        "user_id": admin_user_id,
        "api_key": admin_api_key_value,
        "key_name": "Admin Test Key",
        "is_primary": True,
        "is_active": True,
        "environment_tag": "test",
        "scope_permissions": ["chat", "images", "admin"],
        "created_at": datetime.utcnow().isoformat(),
    }

    admin_key_result = supabase_client.table("api_keys_new").insert(admin_key_data).execute()

    if not admin_key_result.data:
        raise Exception("Failed to create admin API key")

    admin_key_id = admin_key_result.data[0]['id']

    yield admin_api_key_value

    # Cleanup
    try:
        supabase_client.table("api_keys_new").delete().eq("id", admin_key_id).execute()
        supabase_client.table("users").delete().eq("id", admin_user_id).execute()
    except Exception as e:
        print(f"Cleanup error for admin user: {e}")


@pytest.fixture
def cleanup_coupons(supabase_client, test_prefix):
    """Track and cleanup created coupons"""
    created_coupon_ids = []

    def _track_coupon(coupon_id):
        """Track a coupon for cleanup"""
        created_coupon_ids.append(coupon_id)

    yield _track_coupon

    # Cleanup
    try:
        if created_coupon_ids:
            # Delete redemptions first
            supabase_client.table("coupon_redemptions").delete().in_("coupon_id", created_coupon_ids).execute()
            # Delete coupons
            supabase_client.table("coupons").delete().in_("id", created_coupon_ids).execute()
    except Exception as e:
        print(f"Cleanup error for coupons: {e}")


class TestCouponAdminEndpoints:
    """Test admin coupon management endpoints"""

    def test_create_global_coupon(self, client, admin_api_key, test_prefix, cleanup_coupons):
        """Test creating a global promotional coupon"""
        code = f"GLOBAL{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional",
                "description": "Test global coupon"
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert data["code"] == code.upper()  # Should be uppercase
        assert data["value_usd"] == 10.00
        assert data["coupon_scope"] == "global"
        assert data["max_uses"] == 100
        assert data["times_used"] == 0
        assert data["is_active"] is True

        cleanup_coupons(data["id"])

    def test_create_user_specific_coupon(self, client, admin_api_key, test_api_keys, test_prefix, cleanup_coupons):
        """Test creating a user-specific coupon"""
        user = test_api_keys(credits=50.0, username_suffix="coupon_user")
        code = f"USER{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 25.00,
                "coupon_scope": "user_specific",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "compensation",
                "assigned_to_user_id": user["user_id"],
                "description": "Test user-specific coupon"
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert data["code"] == code.upper()
        assert data["coupon_scope"] == "user_specific"
        assert data["assigned_to_user_id"] == user["user_id"]
        assert data["max_uses"] == 1

        cleanup_coupons(data["id"])

    def test_create_coupon_invalid_negative_value(self, client, admin_api_key, test_prefix):
        """Test that negative coupon values are rejected"""
        code = f"INVALID{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": -10.00,
                "coupon_scope": "global",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        assert response.status_code == 422  # Validation error

    def test_create_user_specific_without_assigned_user(self, client, admin_api_key, test_prefix):
        """Test that user-specific coupons require assigned_to_user_id"""
        code = f"INVALID{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "user_specific",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        assert response.status_code == 422  # Validation error

    def test_list_coupons(self, client, admin_api_key, test_prefix, cleanup_coupons):
        """Test listing all coupons"""
        # Create a coupon first
        code = f"LIST{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 5.00,
                "coupon_scope": "global",
                "max_uses": 50,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        cleanup_coupons(create_response.json()["id"])

        # List coupons
        response = client.get(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "coupons" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data
        assert isinstance(data["coupons"], list)

    def test_list_coupons_with_filters(self, client, admin_api_key):
        """Test listing coupons with filters"""
        response = client.get(
            "/admin/coupons?scope=global&is_active=true&limit=10",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "coupons" in data
        # Verify all returned coupons match filters
        for coupon in data["coupons"]:
            assert coupon["coupon_scope"] == "global"
            assert coupon["is_active"] is True

    def test_get_coupon_by_id(self, client, admin_api_key, test_prefix, cleanup_coupons):
        """Test getting a specific coupon by ID"""
        # Create a coupon
        code = f"GETID{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 15.00,
                "coupon_scope": "global",
                "max_uses": 75,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        coupon_id = create_response.json()["id"]
        cleanup_coupons(coupon_id)

        # Get coupon by ID
        response = client.get(
            f"/admin/coupons/{coupon_id}",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == coupon_id
        assert data["code"] == code.upper()
        assert data["value_usd"] == 15.00

    def test_get_nonexistent_coupon(self, client, admin_api_key):
        """Test getting a coupon that doesn't exist"""
        response = client.get(
            "/admin/coupons/999999999",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 404

    def test_update_coupon(self, client, admin_api_key, test_prefix, cleanup_coupons):
        """Test updating coupon fields"""
        # Create a coupon
        code = f"UPDATE{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional",
                "description": "Original description"
            }
        )

        coupon_id = create_response.json()["id"]
        cleanup_coupons(coupon_id)

        # Update description
        response = client.patch(
            f"/admin/coupons/{coupon_id}",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={"description": "Updated description"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["description"] == "Updated description"

    def test_deactivate_coupon(self, client, admin_api_key, test_prefix, cleanup_coupons):
        """Test deactivating a coupon"""
        # Create a coupon
        code = f"DEACT{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        coupon_id = create_response.json()["id"]
        cleanup_coupons(coupon_id)

        # Deactivate
        response = client.delete(
            f"/admin/coupons/{coupon_id}",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True

        # Verify it's deactivated
        get_response = client.get(
            f"/admin/coupons/{coupon_id}",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert get_response.json()["is_active"] is False


class TestCouponUserEndpoints:
    """Test user-facing coupon endpoints"""

    def test_get_available_coupons(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test getting available coupons for a user"""
        user = test_api_keys(credits=50.0, username_suffix="avail_user")

        # Create a global coupon
        global_code = f"AVAIL{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        global_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": global_code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )
        cleanup_coupons(global_response.json()["id"])

        # Create a user-specific coupon
        user_code = f"AVAILUSER{test_prefix}"
        user_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": user_code,
                "value_usd": 20.00,
                "coupon_scope": "user_specific",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "compensation",
                "assigned_to_user_id": user["user_id"]
            }
        )
        cleanup_coupons(user_response.json()["id"])

        # Get available coupons
        response = client.get(
            "/coupons/available",
            headers={"Authorization": f"Bearer {user["api_key"]}"}
        )

        assert response.status_code == 200
        coupons = response.json()

        assert isinstance(coupons, list)
        # Should see both coupons
        coupon_codes = [c["code"] for c in coupons]
        assert global_code.upper() in coupon_codes
        assert user_code.upper() in coupon_codes

    def test_get_available_coupons_unauthorized(self, client):
        """Test that getting available coupons requires authentication"""
        response = client.get("/coupons/available")

        assert response.status_code == 401

    def test_redeem_global_coupon(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test redeeming a global coupon"""
        user = test_api_keys(credits=50.0, username_suffix="redeem_user")

        # Create a global coupon
        code = f"REDEEM{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 15.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # Redeem coupon
        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["coupon_value"] == 15.00
        assert data["previous_balance"] == 50.0
        assert data["new_balance"] == 65.0
        assert data["coupon_code"] == code

    def test_redeem_user_specific_coupon(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test redeeming a user-specific coupon"""
        user = test_api_keys(credits=100.0, username_suffix="specific_user")

        # Create a user-specific coupon
        code = f"SPECIFIC{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 25.00,
                "coupon_scope": "user_specific",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "compensation",
                "assigned_to_user_id": user["user_id"]
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # Redeem coupon
        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["coupon_value"] == 25.00
        assert data["new_balance"] == 125.0

    def test_redeem_coupon_twice_rejected(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test that redeeming the same coupon twice is rejected"""
        user = test_api_keys(credits=50.0, username_suffix="twice_user")

        # Create a global coupon
        code = f"TWICE{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # First redemption - should succeed
        first_response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert first_response.status_code == 200
        assert first_response.json()["success"] is True

        # Second redemption - should fail
        second_response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert second_response.status_code == 400
        data = second_response.json()

        assert data["success"] is False
        assert "error_code" in data

    def test_redeem_invalid_coupon(self, client, test_api_keys):
        """Test redeeming an invalid coupon code"""
        user = test_api_keys(credits=50.0, username_suffix="invalid_user")

        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": "INVALID-NOTEXIST"}
        )

        assert response.status_code == 400
        data = response.json()

        assert data["success"] is False
        assert "error_code" in data

    def test_redeem_expired_coupon(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test that expired coupons cannot be redeemed"""
        user = test_api_keys(credits=50.0, username_suffix="expired_user")

        # Create an expired coupon
        code = f"EXPIRED{test_prefix}"
        expired_date = (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": expired_date,
                "coupon_type": "promotional"
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # Try to redeem
        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert response.status_code == 400
        data = response.json()

        assert data["success"] is False

    def test_redeem_deactivated_coupon(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test that deactivated coupons cannot be redeemed"""
        user = test_api_keys(credits=50.0, username_suffix="deact_user")

        # Create a coupon
        code = f"DEACTIVATE{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        coupon_id = create_response.json()["id"]
        cleanup_coupons(coupon_id)

        # Deactivate it
        client.delete(
            f"/admin/coupons/{coupon_id}",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        # Try to redeem
        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        assert response.status_code == 400
        data = response.json()

        assert data["success"] is False

    def test_get_redemption_history(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test getting user redemption history"""
        user = test_api_keys(credits=50.0, username_suffix="history_user")

        # Create and redeem a coupon
        code = f"HISTORY{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # Redeem it
        client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        # Get history
        response = client.get(
            "/coupons/history",
            headers={"Authorization": f"Bearer {user["api_key"]}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "redemptions" in data
        assert "total_redemptions" in data
        assert "total_value_redeemed" in data
        assert data["total_redemptions"] >= 1
        assert data["total_value_redeemed"] >= 10.0

    def test_get_redemption_history_with_limit(self, client, test_api_keys):
        """Test getting redemption history with limit parameter"""
        user = test_api_keys(credits=50.0, username_suffix="limit_user")

        response = client.get(
            "/coupons/history?limit=5",
            headers={"Authorization": f"Bearer {user["api_key"]}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "redemptions" in data
        assert len(data["redemptions"]) <= 5


class TestCouponAnalytics:
    """Test coupon analytics endpoints"""

    def test_get_coupon_analytics(self, client, test_api_keys, admin_api_key, test_prefix, cleanup_coupons):
        """Test getting analytics for a specific coupon"""
        user = test_api_keys(credits=100.0, username_suffix="analytics_user")

        # Create a coupon
        code = f"ANALYTICS{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        coupon_id = create_response.json()["id"]
        cleanup_coupons(coupon_id)

        # Redeem it
        client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user["api_key"]}"},
            json={"code": code}
        )

        # Get analytics
        response = client.get(
            f"/admin/coupons/{coupon_id}/analytics",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "coupon" in data
        assert "total_redemptions" in data
        assert "unique_users" in data
        assert "total_value_distributed" in data
        assert "redemption_rate" in data
        assert "remaining_uses" in data
        assert "is_expired" in data

        assert data["total_redemptions"] >= 1
        assert data["unique_users"] >= 1
        assert data["total_value_distributed"] >= 10.0

    def test_get_system_stats(self, client, admin_api_key):
        """Test getting system-wide coupon statistics"""
        response = client.get(
            "/admin/coupons/stats/overview",
            headers={"Authorization": f"Bearer {admin_api_key}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "total_coupons" in data
        assert "active_coupons" in data
        assert "user_specific_coupons" in data
        assert "global_coupons" in data
        assert "total_redemptions" in data
        assert "unique_redeemers" in data
        assert "total_value_distributed" in data
        assert "average_redemption_value" in data


class TestCouponEdgeCases:
    """Test edge cases and error scenarios"""

    def test_create_coupon_without_admin_key(self, client, test_prefix):
        """Test that creating coupons requires admin API key"""
        code = f"NOAUTH{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        response = client.post(
            "/admin/coupons",
            json={
                "code": code,
                "value_usd": 10.00,
                "coupon_scope": "global",
                "max_uses": 100,
                "valid_until": valid_until,
                "coupon_type": "promotional"
            }
        )

        assert response.status_code == 401

    def test_redeem_without_authentication(self, client):
        """Test that redeeming requires authentication"""
        response = client.post(
            "/coupons/redeem",
            json={"code": "SOMECODDE"}
        )

        assert response.status_code == 401

    def test_wrong_user_cannot_redeem_user_specific_coupon(self, client, test_api_keys, admin_api_key, test_prefix,
                                                           cleanup_coupons):
        """Test that user-specific coupons can only be redeemed by the assigned user"""
        user1 = test_api_keys(credits=50.0, username_suffix="user1")
        user2 = test_api_keys(credits=50.0, username_suffix="user2")

        # Create coupon for user1
        code = f"USER1ONLY{test_prefix}"
        valid_until = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        create_response = client.post(
            "/admin/coupons",
            headers={"Authorization": f"Bearer {admin_api_key}"},
            json={
                "code": code,
                "value_usd": 20.00,
                "coupon_scope": "user_specific",
                "max_uses": 1,
                "valid_until": valid_until,
                "coupon_type": "compensation",
                "assigned_to_user_id": user1["user_id"]
            }
        )
        cleanup_coupons(create_response.json()["id"])

        # Try to redeem with user2
        response = client.post(
            "/coupons/redeem",
            headers={"Authorization": f"Bearer {user2['api_key']}"},
            json={"code": code}
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False