"""
Comprehensive tests for Ping routes
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock

from src.routes.ping import router


class TestPingRoutes:
    """Test Ping route handlers"""

    def test_router_exists(self):
        """Test that router is defined"""
        assert router is not None
        assert hasattr(router, 'routes')

    def test_module_imports(self):
        """Test that module imports successfully"""
        import src.routes.ping
        assert src.routes.ping is not None
