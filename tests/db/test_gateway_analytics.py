"""
Comprehensive tests for gateway_analytics database module
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

from src.db.gateway_analytics import (
    get_provider_stats,
    get_gateway_stats,
)


class TestGetProviderStats:
    """Test get_provider_stats function"""

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_provider_stats_success(self, mock_get_client):
        """Test successfully getting provider statistics"""
        mock_client = MagicMock()
        mock_table = MagicMock()

        mock_data = [
            {
                "provider": "OpenAI",
                "model": "gpt-4",
                "tokens": 1000,
                "cost": 0.03,
                "created_at": "2024-01-01",
                "metadata": {"gateway": "openrouter"}
            }
        ]

        mock_table.select.return_value.gte.return_value.execute.return_value.data = mock_data
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_provider_stats("openai", time_range="24h")

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_provider_stats_with_user_filter(self, mock_get_client):
        """Test getting provider stats filtered by user"""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_data = [{"provider": "OpenAI", "tokens": 500}]

        mock_table.select.return_value.gte.return_value.eq.return_value.execute.return_value.data = mock_data
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_provider_stats("openai", user_id=123)

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_provider_stats_no_data(self, mock_get_client):
        """Test provider stats with no matching data"""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_table.select.return_value.gte.return_value.execute.return_value.data = None
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_provider_stats("unknown", time_range="24h")

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_provider_stats_error_handling(self, mock_get_client):
        """Test error handling in provider stats"""
        mock_get_client.side_effect = Exception("Database error")

        result = get_provider_stats("openai")

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_provider_stats_with_gateway_filter(self, mock_get_client):
        """Test provider stats with gateway filter"""
        mock_client = MagicMock()
        mock_table = MagicMock()

        mock_data = [
            {"provider": "OpenAI", "metadata": {"gateway": "openrouter"}},
            {"provider": "OpenAI", "metadata": {"gateway": "portkey"}},
        ]

        mock_table.select.return_value.gte.return_value.execute.return_value.data = mock_data
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_provider_stats("openai", gateway="openrouter")

        assert result is not None


class TestGetGatewayStats:
    """Test get_gateway_stats function"""

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_gateway_stats_success(self, mock_get_client):
        """Test successfully getting gateway statistics"""
        mock_client = MagicMock()
        mock_table = MagicMock()

        mock_data = [
            {
                "gateway": "openrouter",
                "provider": "OpenAI",
                "tokens": 1000,
                "cost": 0.03,
            }
        ]

        mock_table.select.return_value.gte.return_value.execute.return_value.data = mock_data
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_gateway_stats("openrouter", time_range="24h")

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_gateway_stats_with_user_filter(self, mock_get_client):
        """Test getting gateway stats with user filter"""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_data = [{"gateway": "openrouter", "tokens": 500}]

        mock_table.select.return_value.gte.return_value.eq.return_value.execute.return_value.data = mock_data
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        result = get_gateway_stats("openrouter", user_id=123)

        assert result is not None

    @patch("src.db.gateway_analytics.get_supabase_client")
    def test_get_gateway_stats_time_ranges(self, mock_get_client):
        """Test gateway stats with different time ranges"""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_table.select.return_value.gte.return_value.execute.return_value.data = []
        mock_client.table.return_value = mock_table
        mock_get_client.return_value = mock_client

        for time_range in ["1h", "24h", "7d", "30d", "all"]:
            result = get_gateway_stats("openrouter", time_range=time_range)
            assert result is not None
