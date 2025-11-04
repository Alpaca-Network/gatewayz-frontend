# Manual Integration Test Scripts

This directory contains **ad-hoc integration testing scripts** for manual validation and debugging. These are NOT part of the automated test suite and should NOT be run with pytest.

## Purpose

These scripts are used to:
- Test integration with external providers (OpenRouter, HuggingFace, Google Vertex AI, etc.)
- Validate provider-specific implementations in isolation
- Debug API integrations and model transformations
- Manual validation during development

## Files

- `test_aimo_integration.py` - AIMO Network integration testing
- `test_arch_router_backend.py` - Arch Router backend validation through gateway
- `test_arch_router_huggingface.py` - Arch Router HuggingFace provider integration
- `test_braintrust_openrouter.py` - Braintrust tracing with OpenRouter
- `test_cerebras_fix.py` - Cerebras model fetching validation
- `test_chat_endpoints_alpaca_openrouter.py` - Chat endpoints with multiple providers
- `test_claude_sonnet_4_5.py` - Claude Sonnet 4.5 model integration
- `test_gateway_models.py` - Gateway model catalog validation
- `test_google_vertex_endpoint.py` - Google Vertex AI image generation
- `test_model_count.py` - Model counting logic validation
- `test_openrouter_auto.py` - OpenRouter auto model testing
- `test_statsig_logging.py` - Statsig event logging validation

## Running Manually

Each script requires specific API keys and configurations. Run individually as needed:

```bash
# Set up environment variables first
export AIMO_API_KEY="your-key"
export OPENROUTER_API_KEY="your-key"
export HUG_API_KEY="your-key"
export GATEWAY_API_KEY="your-key"

# Run a specific script
python scripts/integration-tests/test_aimo_integration.py
python scripts/integration-tests/test_openrouter_auto.py
```

## Important Notes

⚠️ **These scripts are NOT included in pytest** because:
- They require external API keys
- They call `sys.exit(1)` when dependencies are missing
- They are designed for manual testing, not CI/CD automation
- They are not structured as proper pytest tests

For automated testing, see `/root/repo/tests/` instead.

## CI/CD Integration

These scripts should be run manually during development or for specific provider validation. They are NOT part of the GitHub Actions CI pipeline.
