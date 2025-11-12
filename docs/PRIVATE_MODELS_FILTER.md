# Private Models Filter

## Overview

Near AI models are now tagged as "Private" models due to their unique security features including:
- Private AI inference
- Decentralized execution
- Cryptographic verification
- On-chain auditing
- User-owned AI services

All Near AI models automatically have:
- `is_private: true` field
- `tags: ["Private"]` array
- `security_features` metadata object

## API Usage

### Filter Query Parameter

The `is_private` query parameter is available on the following endpoints:

1. **GET /v1/models** - List all models with filtering
2. **GET /models** - Legacy endpoint (same as above)
3. **GET /v1/models/search** - Advanced model search

### Parameter Values

- `is_private=true` - Show only private models (Near AI models)
- `is_private=false` - Exclude private models (show all non-Near AI models)
- `is_private` omitted or `null` - Show all models (default)

## API Examples

### Example 1: Get only private models

```bash
# Show only Near AI private models
curl "https://api.yourdomain.com/v1/models?is_private=true&gateway=all"
```

Response:
```json
{
  "data": [
    {
      "id": "near/deepseek-ai/DeepSeek-V3.1",
      "name": "DeepSeek V3.1",
      "is_private": true,
      "tags": ["Private"],
      "security_features": {
        "private_inference": true,
        "decentralized": true,
        "verifiable": true,
        "on_chain_auditing": true,
        "user_owned": true
      },
      "provider_slug": "near",
      "source_gateway": "near",
      ...
    },
    ...
  ],
  "total": 4,
  "returned": 4,
  ...
}
```

### Example 2: Exclude private models

```bash
# Show all models except Near AI private models
curl "https://api.yourdomain.com/v1/models?is_private=false&gateway=all"
```

### Example 3: Advanced search with private filter

```bash
# Search for private models with large context
curl "https://api.yourdomain.com/v1/models/search?is_private=true&min_context=60000&sort_by=context&order=desc"
```

### Example 4: Combine with other filters

```bash
# Get cheap private models
curl "https://api.yourdomain.com/v1/models/search?is_private=true&max_price=0.0001&sort_by=price"
```

## Frontend Implementation

### Sidebar Filter Toggle

To add a "Private Models" toggle in your frontend sidebar:

```javascript
// Example React/Next.js implementation
const [showPrivateOnly, setShowPrivateOnly] = useState(false);
const [hidePrivate, setHidePrivate] = useState(false);

// Build query params
const getQueryParams = () => {
  const params = new URLSearchParams();

  if (showPrivateOnly) {
    params.set('is_private', 'true');
  } else if (hidePrivate) {
    params.set('is_private', 'false');
  }
  // is_private param not added if neither option is selected

  return params.toString();
};

// Fetch models
const fetchModels = async () => {
  const queryString = getQueryParams();
  const response = await fetch(`/v1/models?${queryString}`);
  return response.json();
};

// UI Components
<div className="sidebar-filters">
  <h3>Model Filters</h3>

  <div className="filter-section">
    <label>
      <input
        type="checkbox"
        checked={showPrivateOnly}
        onChange={(e) => {
          setShowPrivateOnly(e.target.checked);
          if (e.target.checked) setHidePrivate(false);
        }}
      />
      Private Models Only
    </label>

    <label>
      <input
        type="checkbox"
        checked={hidePrivate}
        onChange={(e) => {
          setHidePrivate(e.target.checked);
          if (e.target.checked) setShowPrivateOnly(false);
        }}
      />
      Hide Private Models
    </label>
  </div>
</div>
```

### Displaying Private Badge

```javascript
// Show a badge for private models
const ModelCard = ({ model }) => (
  <div className="model-card">
    <h4>{model.name}</h4>

    {model.is_private && (
      <span className="badge badge-private">
        🔒 Private
      </span>
    )}

    {model.tags && model.tags.includes("Private") && (
      <div className="security-features">
        <small>
          • Private Inference
          • Decentralized
          • Verifiable
        </small>
      </div>
    )}

    ...
  </div>
);
```

## Model Data Structure

### Near AI Model Example

```json
{
  "id": "near/deepseek-ai/DeepSeek-V3.1",
  "slug": "near/deepseek-ai/DeepSeek-V3.1",
  "canonical_slug": "near/deepseek-ai/DeepSeek-V3.1",
  "name": "Deepseek Ai Deepseek V3.1",
  "description": "Near AI hosted model deepseek-ai/DeepSeek-V3.1. Security: Private AI inference with decentralized execution, cryptographic verification, and on-chain auditing.",
  "is_private": true,
  "tags": ["Private"],
  "provider_slug": "near",
  "provider_site_url": "https://near.ai",
  "source_gateway": "near",
  "security_features": {
    "private_inference": true,
    "decentralized": true,
    "verifiable": true,
    "on_chain_auditing": true,
    "user_owned": true
  },
  "context_length": 65536,
  "pricing": {
    "prompt": "0.14",
    "completion": "0.28"
  },
  ...
}
```

## Benefits of Private Models

Near AI models provide unique advantages:

1. **Privacy**: Your data is not used for training or shared with third parties
2. **Decentralization**: Infrastructure is distributed, avoiding single points of failure
3. **Verification**: Cryptographic proofs ensure model execution integrity
4. **Auditability**: On-chain records provide transparency
5. **Ownership**: Users maintain control over their AI services

## Implementation Details

### Backend Changes

1. **src/services/models.py**:
   - Added `is_private: true` to all Near AI models in `normalize_near_model()`
   - Added `tags: ["Private"]` to identify private models

2. **src/routes/catalog.py**:
   - Added `is_private` query parameter to `/v1/models` endpoint
   - Added `is_private` query parameter to `/v1/models/search` endpoint
   - Implemented filtering logic to show/hide private models based on parameter value

### Testing

Run the test suite to verify the implementation:

```bash
python3 test_private_filter.py
```

## Notes

- Only Near AI models are currently marked as private
- Other providers may support privacy features but are not automatically tagged as private
- The filter is optional and backward-compatible (existing API calls continue to work)
- Frontend implementations should handle the case where `is_private` field is not present (older models)

## Support

For questions or issues:
- Check API documentation at `/docs` (Swagger UI)
- Review this documentation
- Contact support team
