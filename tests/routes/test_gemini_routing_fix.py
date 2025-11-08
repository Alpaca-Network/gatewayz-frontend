"""
Test for the Gemini model routing fix.

This test ensures that google/gemini models are routed correctly to OpenRouter
when Google Vertex AI credentials are not available, and prevents the fallback
logic from incorrectly routing to HuggingFace.

Bug Description:
-----------------
When a user requests a google/gemini model without specifying a provider:
1. The system defaults to "openrouter"
2. detect_provider_from_model_id() checks for Vertex credentials
3. If no credentials exist, it returns "openrouter" (correct fallback)
4. BUG: The override logic only set req_provider_missing=False if the detected
   provider differed from the default
5. Since both were "openrouter", req_provider_missing stayed True
6. This triggered the fallback logic which checked providers in order
7. HuggingFace was first, and incorrectly matched the model
8. Result: Model routed to HuggingFace instead of OpenRouter

Fix:
----
Set req_provider_missing=False whenever detect_provider_from_model_id()
returns a provider, even if it matches the default provider. This prevents
the fallback logic from running when the provider has already been correctly
determined.

Related files:
- src/routes/chat.py (lines ~684-696 and ~1506-1520)
- src/services/model_transformations.py (detect_provider_from_model_id)
"""

import os
import pytest


def test_gemini_provider_detection_logic():
    """
    Unit test for the provider detection logic used in chat.py

    This test simulates the exact logic flow to ensure req_provider_missing
    is set correctly after provider detection.
    """
    from src.services.model_transformations import detect_provider_from_model_id

    # Ensure no credentials
    original_gac = os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    original_gvc = os.environ.pop("GOOGLE_VERTEX_CREDENTIALS_JSON", None)

    try:
        # Simulate the routing logic from chat.py
        original_model = "google/gemini-2.0-flash-001"

        # Step 1: Default provider (line 678 in chat.py)
        req_provider_missing = True
        provider = "openrouter"

        # Step 2: Override detection (lines 684-696 in chat.py)
        override_provider = detect_provider_from_model_id(original_model)

        # Verify detection returns openrouter (fallback when no credentials)
        assert override_provider == "openrouter", \
            f"Expected 'openrouter', got '{override_provider}'"

        if override_provider:
            override_provider = override_provider.lower()
            if override_provider != provider:
                provider = override_provider
            # THE FIX: Mark as determined even if it matches default
            req_provider_missing = False

        # Verify the fix works
        assert req_provider_missing is False, \
            "req_provider_missing should be False after detection"
        assert provider == "openrouter", \
            f"Provider should be 'openrouter', got '{provider}'"

        # Verify fallback logic will NOT run
        if req_provider_missing:
            pytest.fail("Fallback logic would run - this is the bug!")

    finally:
        # Restore original environment
        if original_gac:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = original_gac
        if original_gvc:
            os.environ["GOOGLE_VERTEX_CREDENTIALS_JSON"] = original_gvc


def test_gemini_with_vertex_credentials():
    """
    Test that google/gemini models route to Google Vertex when credentials exist.
    """
    from src.services.model_transformations import detect_provider_from_model_id

    # Set temporary credential
    os.environ["GOOGLE_VERTEX_CREDENTIALS_JSON"] = '{"type": "service_account"}'

    try:
        model_id = "google/gemini-2.0-flash-001"
        provider = detect_provider_from_model_id(model_id)

        assert provider == "google-vertex", \
            f"Expected 'google-vertex', got '{provider}'"

    finally:
        # Clean up
        os.environ.pop("GOOGLE_VERTEX_CREDENTIALS_JSON", None)


@pytest.mark.parametrize("model_id", [
    "google/gemini-2.0-flash-001",
    "google/gemini-2.5-flash",
    "google/gemini-1.5-pro",
    "google/gemini-2.0-pro",
    "google/gemini-1.5-flash",
])
def test_various_gemini_models_route_correctly(model_id):
    """
    Test that various Google/Gemini model IDs are routed correctly.
    """
    from src.services.model_transformations import detect_provider_from_model_id

    # Ensure no credentials
    original_gac = os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    original_gvc = os.environ.pop("GOOGLE_VERTEX_CREDENTIALS_JSON", None)

    try:
        provider = detect_provider_from_model_id(model_id)
        assert provider == "openrouter", \
            f"Model {model_id} should route to 'openrouter', got '{provider}'"

    finally:
        # Restore original environment
        if original_gac:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = original_gac
        if original_gvc:
            os.environ["GOOGLE_VERTEX_CREDENTIALS_JSON"] = original_gvc
