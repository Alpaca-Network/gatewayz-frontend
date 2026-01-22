# Agent Instructions

For high-level project context and detailed guidelines, see [CLAUDE.MD](../CLAUDE.md).

## Quick Reference: Adding a New Gateway

New gateways are automatically discovered from the backend - no frontend code changes required!

**To add a new gateway:**

1. **Add to backend `GATEWAY_REGISTRY`** in `backend/src/routes/catalog.py`:
```python
"new-gateway": {
    "name": "New Gateway",
    "color": "bg-purple-500",
    "priority": "slow",
    "site_url": "https://newgateway.com",
},
```

2. **Ensure models include `source_gateway: "new-gateway"`** in the backend

3. **The frontend will automatically discover and display the new gateway!**

## Gateway Discovery Code

- `src/lib/gateway-registry.ts` - Contains dynamic gateway registration functions (`registerDynamicGateway`, `autoRegisterGatewaysFromModels`)
- `src/lib/models-service.ts` - Calls gateway discovery when fetching models
- Static `GATEWAYS` array provides offline/error resilience
