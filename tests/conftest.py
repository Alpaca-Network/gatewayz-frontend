# tests/conftest.py
import pytest

@pytest.fixture
def anyio_backend():
    # Force pytest-anyio to run with asyncio only
    return "asyncio"
