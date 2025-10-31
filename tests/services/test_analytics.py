#!/usr/bin/env python3
"""
Tests for analytics service

Tests cover:
- Trial analytics retrieval
"""

import pytest
from src.services.analytics import get_trial_analytics


class TestTrialAnalytics:
    """Test trial analytics function"""

    def test_get_trial_analytics_returns_dict(self):
        """Test that get_trial_analytics returns a dictionary"""
        result = get_trial_analytics()
        assert isinstance(result, dict)

    def test_get_trial_analytics_has_required_keys(self):
        """Test that result has all required keys"""
        result = get_trial_analytics()

        assert 'signups' in result
        assert 'started_trial' in result
        assert 'converted' in result
        assert 'conversion_rate' in result

    def test_get_trial_analytics_default_values(self):
        """Test that default values are zero (TODO implementation)"""
        result = get_trial_analytics()

        assert result['signups'] == 0
        assert result['started_trial'] == 0
        assert result['converted'] == 0
        assert result['conversion_rate'] == 0.0

    def test_get_trial_analytics_value_types(self):
        """Test that values have correct types"""
        result = get_trial_analytics()

        assert isinstance(result['signups'], int)
        assert isinstance(result['started_trial'], int)
        assert isinstance(result['converted'], int)
        assert isinstance(result['conversion_rate'], float)
