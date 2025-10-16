# Modelz Integration - Bridge between Modelz and Gatewayz

## Overview

The Modelz integration provides a bridge between Gatewayz and the Modelz platform, allowing users to check which models already exist on Modelz or have tokens. This integration wraps the Modelz API (`https://backend.alpacanetwork.ai/api/tokens`) and provides the same filtering capabilities.

## Features

- ✅ **Model Discovery**: Find all models that exist on Modelz
- ✅ **Graduation Filtering**: Filter by graduated (singularity) vs non-graduated models
- ✅ **Model Checking**: Check if specific models exist on Modelz
- ✅ **Token Data**: Access full token metadata from Modelz
- ✅ **Lightweight Endpoints**: Get just model IDs for quick lookups

## API Endpoints

### 1. Get Models from Modelz

**Endpoint:** `GET /modelz/models`

**Description:** Get all models that exist on Modelz with optional graduation filter.

**Query Parameters:**
- `isGraduated` (optional): Filter for graduated models
  - `true`: Only graduated/singularity models
  - `false`: Only non-graduated models
  - `null` (default): All models

**Example Requests:**
```bash
# Get all models
GET /modelz/models

# Get only graduated models
GET /modelz/models?isGraduated=true

# Get only non-graduated models
GET /modelz/models?isGraduated=false
```

**Example Response:**
```json
{
  "models": [
    {
      "model_id": "DeepSeek-R1",
      "is_graduated": true,
      "token_data": {
        "_id": "...",
        "Token": "DeepSeek-R1",
        "isGraduated": true,
        "MarketCap": 1234567,
        "priceInUSD": 0.001,
        "Holders": 1500,
        "volume24h": 50000,
        "website": "https://example.com",
        "imgurl": "https://example.com/logo.png"
      },
      "source": "modelz",
      "has_token": true
    }
  ],
  "total_count": 53,
  "filter": {
    "is_graduated": null,
    "description": "All models"
  },
  "source": "modelz",
  "api_reference": "https://backend.alpacanetwork.ai/api/tokens"
}
```

### 2. Get Model IDs Only

**Endpoint:** `GET /modelz/ids`

**Description:** Get a lightweight list of model IDs that exist on Modelz.

**Query Parameters:**
- `isGraduated` (optional): Same filtering as above

**Example Request:**
```bash
GET /modelz/ids?isGraduated=true
```

**Example Response:**
```json
{
  "model_ids": [
    "DeepSeek-R1",
    "Meta-Llama-3-8B",
    "whisper-large-v3"
  ],
  "total_count": 53,
  "filter": {
    "is_graduated": true,
    "description": "Graduated models only"
  },
  "source": "modelz"
}
```

### 3. Check Specific Model

**Endpoint:** `GET /modelz/check/{model_id}`

**Description:** Check if a specific model exists on Modelz.

**Path Parameters:**
- `model_id`: The model ID to check

**Query Parameters:**
- `isGraduated` (optional): Filter for graduated models when checking

**Example Request:**
```bash
GET /modelz/check/DeepSeek-R1?isGraduated=true
```

**Example Response:**
```json
{
  "model_id": "DeepSeek-R1",
  "exists_on_modelz": true,
  "filter": {
    "is_graduated": true,
    "description": "Graduated models only"
  },
  "source": "modelz",
  "model_details": {
    "_id": "...",
    "Token": "DeepSeek-R1",
    "isGraduated": true,
    "MarketCap": 1234567,
    "priceInUSD": 0.001,
    "Holders": 1500,
    "volume24h": 50000,
    "website": "https://example.com",
    "imgurl": "https://example.com/logo.png"
  }
}
```

## Token Data Fields

The Modelz API returns rich token data including:

- **`Token`**: Model identifier/name
- **`isGraduated`**: Whether the model is graduated (singularity)
- **`MarketCap`**: Market capitalization
- **`priceInUSD`**: Current price in USD
- **`Holders`**: Number of token holders
- **`volume24h`**: 24-hour trading volume
- **`website`**: Model website URL
- **`imgurl`**: Model logo/image URL
- **`contractAddress`**: Smart contract address
- **`CirculatingSupply`**: Circulating token supply
- **`TotalSupply`**: Total token supply
- **`TVL`**: Total Value Locked
- **`hrChg24`**: 24-hour price change
- **`hrChg7d`**: 7-day price change
- **`hrChg30d`**: 30-day price change

## Use Cases

### 1. Model Discovery
```bash
# Find all models available on Modelz
curl "http://localhost:8000/modelz/models"
```

### 2. Graduated Models Only
```bash
# Get only graduated (singularity) models
curl "http://localhost:8000/modelz/models?isGraduated=true"
```

### 3. Check Specific Model
```bash
# Check if a model exists on Modelz
curl "http://localhost:8000/modelz/check/DeepSeek-R1"
```

### 4. Frontend Integration
```javascript
// Check if models exist on Modelz
async function checkModelsOnModelz(modelIds) {
  const results = await Promise.all(
    modelIds.map(async (modelId) => {
      const response = await fetch(`/modelz/check/${modelId}`);
      const data = await response.json();
      return {
        modelId,
        existsOnModelz: data.exists_on_modelz,
        isGraduated: data.model_details?.isGraduated
      };
    })
  );
  return results;
}
```

## Error Handling

The endpoints handle various error scenarios:

- **504 Gateway Timeout**: When Modelz API is slow to respond
- **502 Bad Gateway**: When Modelz API returns an error
- **500 Internal Server Error**: For unexpected errors

Example error response:
```json
{
  "detail": "Timeout while fetching data from Modelz API"
}
```

## Performance Considerations

- **Caching**: Consider implementing caching for frequently accessed data
- **Rate Limiting**: Modelz API may have rate limits
- **Timeout**: 30-second timeout for Modelz API requests
- **Lightweight Option**: Use `/modelz/ids` for quick model ID lookups

## Integration with Existing Features

The Modelz integration complements existing Gatewayz features:

- **Model Comparison**: Compare models across gateways and check Modelz availability
- **Provider Analytics**: Include Modelz data in provider statistics
- **Model Search**: Filter search results by Modelz availability
- **Pricing Analysis**: Compare Gatewayz pricing with Modelz token prices

## Testing

Run the test script to verify the integration:

```bash
python test_modelz_integration.py
```

This will test all endpoints and verify they work correctly with the Modelz API.

## Future Enhancements

Potential future improvements:

1. **Caching**: Implement Redis caching for Modelz data
2. **Real-time Updates**: WebSocket updates for token price changes
3. **Batch Operations**: Check multiple models in a single request
4. **Analytics**: Track Modelz model usage across Gatewayz
5. **Notifications**: Alert when models graduate or new models are added
