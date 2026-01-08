# Cerebras Gateway Backend Bug Report

## Issue Summary
The Cerebras gateway endpoint (`/v1/models?gateway=cerebras`) is returning malformed model data where Python object representations are being returned instead of properly parsed JSON objects.

## Current Behavior
When querying the Cerebras gateway, the API returns models with:
- **Names like**: `('Data', [Data(Id='Llama3.1 8B', Created=0, Object='Model', Owned By='Cerebras'), ...])`
- **IDs like**: `@cerebras/('data', [Data(id='llama3.1-8b', created=0, object='model', owned_by='Cerebras'), ...])`
- **Only 2 malformed records** instead of the 8 actual Cerebras models

## Example API Response
```json
{
  "data": [
    {
      "id": "@cerebras/('data', [Data(id='llama3.1-8b', created=0, object='model', owned_by='Cerebras'), ...])",
      "name": "('Data', [Data(Id='Llama3.1 8B', Created=0, Object='Model', Owned By='Cerebras'), ...])",
      "description": "Cerebras hosted model: ('data', [Data(id='llama3.1-8b', ...)])",
      "source_gateway": "cerebras"
    },
    {
      "id": "@cerebras/('object', 'list')",
      "name": "('Object', 'List')",
      "description": "Cerebras hosted model: ('object', 'list')",
      "source_gateway": "cerebras"
    }
  ],
  "total": 2
}
```

## Expected Behavior
The API should return 8 properly formatted model records:

```json
{
  "data": [
    {
      "id": "cerebras/llama3.1-8b",
      "name": "Llama 3.1 8B",
      "description": "Meta's Llama 3.1 8B model hosted on Cerebras",
      "source_gateway": "cerebras",
      "provider_slug": "cerebras",
      "context_length": 8192,
      "pricing": {
        "prompt": "0.000001",
        "completion": "0.000002"
      }
    },
    {
      "id": "cerebras/llama-3.3-70b",
      "name": "Llama 3.3 70B",
      ...
    },
    ...
  ],
  "total": 8
}
```

## Actual Cerebras Models
Based on the stringified data, the actual models that should be returned are:
1. `llama3.1-8b`
2. `llama-3.3-70b`
3. `gpt-oss-120b`
4. `llama-4-scout-17b-16e-instruct`
5. `qwen-3-235b-a22b-instruct-2507`
6. `qwen-3-32b`
7. `qwen-3-coder-480b`
8. `qwen-3-235b-a22b-thinking-2507`

## Root Cause Analysis
The backend appears to be:
1. Receiving the Cerebras API response correctly (which likely returns a list of model objects)
2. But instead of properly parsing the response, it's converting Python `Data` objects to strings using `str()` or `repr()`
3. This suggests the Cerebras SDK/client is returning custom Python objects that aren't being properly serialized to JSON

## Suggested Fix
The backend code processing Cerebras responses should:
1. Properly extract the `data` field from the Cerebras API response
2. Iterate through each model object in the list
3. Extract individual fields (id, name, created, owned_by) from each model
4. Transform them into the standard model format used by other gateways

Example fix (Python pseudocode):
```python
# Current (broken) code appears to be doing:
cerebras_response = cerebras_client.models.list()
model_data = str(cerebras_response)  # Wrong!

# Should be doing:
cerebras_response = cerebras_client.models.list()
models = []
for model in cerebras_response.data:  # Iterate through actual model objects
    models.append({
        "id": f"cerebras/{model.id}",
        "name": format_model_name(model.id),
        "description": f"Cerebras hosted {model.id}",
        "provider_slug": "cerebras",
        "source_gateway": "cerebras",
        # ... other fields
    })
```

## Impact
- **User Impact**: HIGH - Users cannot browse Cerebras models via the frontend
- **Current Frontend Workaround**: Malformed models are filtered out client-side, showing "No models found" for Cerebras
- **Urgency**: HIGH - This breaks a core feature (model discovery for Cerebras)

## Testing
To verify the fix:
1. Query `/v1/models?gateway=cerebras&limit=10`
2. Verify response contains 8 properly formatted models
3. Verify model names are human-readable (e.g., "Llama 3.1 8B" not "('Data', [Data(Id=...")
4. Verify IDs follow the pattern `cerebras/model-name` or `@cerebras/model-name`
5. Test the frontend at `https://beta.gatewayz.ai/models?gateways=cerebras` to confirm models display correctly

## Related Files
- Backend: API endpoint handling Cerebras gateway queries
- Frontend (temporary workaround): `src/app/models/models-client.tsx` (lines 234-247)

## Date Reported
2025-10-27

## Reported By
Frontend fix applied by Terry (Terragon Labs AI)
