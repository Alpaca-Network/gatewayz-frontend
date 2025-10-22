"""
Smoke Tests Package

Post-deployment validation tests that run after every deployment to ensure
the application is healthy and critical functionality works.

Usage:
    # Run locally
    pytest tests/smoke/ -v

    # Run against staging
    BASE_URL=https://staging.gatewayz.ai pytest tests/smoke/ -v

    # Run against production (with test API key)
    BASE_URL=https://api.gatewayz.ai TEST_API_KEY=your_test_key pytest tests/smoke/ -v

    # Run only smoke tests
    pytest -m smoke -v
"""
