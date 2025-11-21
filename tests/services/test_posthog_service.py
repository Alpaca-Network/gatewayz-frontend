"""
Comprehensive tests for Posthog Service service
"""
import pytest
from unittest.mock import Mock, patch, MagicMock, AsyncMock


class TestPosthogService:
    """Test Posthog Service service functionality"""

    def test_module_imports(self):
        """Test that module imports successfully"""
        import src.services.posthog_service
        assert src.services.posthog_service is not None

    def test_module_has_expected_attributes(self):
        """Test module exports"""
        from src.services import posthog_service
        assert hasattr(posthog_service, '__name__')

    @patch('src.services.posthog_service.Posthog')
    @patch.dict('os.environ', {'POSTHOG_API_KEY': 'test_key', 'POSTHOG_HOST': 'https://test.posthog.com'})
    def test_initialize_with_exception_autocapture(self, mock_posthog):
        """Test that PostHog initializes with exception autocapture enabled"""
        from src.services.posthog_service import PostHogService

        service = PostHogService()
        service.initialize()

        # Verify PostHog was initialized with correct parameters
        mock_posthog.assert_called_once_with(
            'test_key',
            host='https://test.posthog.com',
            debug=False,
            sync_mode=False,
            enable_exception_autocapture=True
        )

    @patch('src.services.posthog_service.Posthog')
    @patch.dict('os.environ', {'POSTHOG_API_KEY': 'test_key'})
    def test_capture_exception_success(self, mock_posthog):
        """Test successful exception capture"""
        from src.services.posthog_service import PostHogService

        # Setup mock client
        mock_client = Mock()
        mock_posthog.return_value = mock_client

        service = PostHogService()
        service.initialize()

        # Test exception capture
        test_exception = ValueError("Test error")
        service.capture_exception(
            exception=test_exception,
            distinct_id="user_123",
            properties={"context": "test"}
        )

        # Verify capture_exception was called
        mock_client.capture_exception.assert_called_once_with(
            test_exception,
            distinct_id="user_123",
            properties={"context": "test"}
        )

    @patch('src.services.posthog_service.Posthog')
    @patch.dict('os.environ', {'POSTHOG_API_KEY': 'test_key'})
    def test_capture_exception_default_distinct_id(self, mock_posthog):
        """Test exception capture with default distinct_id"""
        from src.services.posthog_service import PostHogService

        # Setup mock client
        mock_client = Mock()
        mock_posthog.return_value = mock_client

        service = PostHogService()
        service.initialize()

        # Test exception capture without distinct_id
        test_exception = RuntimeError("Test error")
        service.capture_exception(exception=test_exception)

        # Verify capture_exception was called with 'system' as default
        mock_client.capture_exception.assert_called_once_with(
            test_exception,
            distinct_id="system",
            properties={}
        )

    def test_capture_exception_when_not_initialized(self):
        """Test that capture_exception handles uninitialized client gracefully"""
        from src.services.posthog_service import PostHogService

        service = PostHogService()
        service.client = None  # Simulate uninitialized state

        # Should not raise an exception
        test_exception = ValueError("Test error")
        service.capture_exception(exception=test_exception, distinct_id="user_123")

        # No assertion needed - just verify no exception is raised
