# Models Export Guide

## Quick Start

Export all models and their prices to CSV:

```bash
python export_models_to_csv.py
```

This will create a CSV file named `models_export_YYYY-MM-DD_HHMMSS.csv` in the project root.

## CSV Format

The exported CSV contains the following columns:

| Column | Description |
|--------|-------------|
| `gateway` | Gateway source (openrouter, portkey, featherless, deepinfra, chutes, groq, fireworks, together) |
| `id` | Model ID (e.g., "openai/gpt-4") |
| `name` | Display name of the model |
| `provider` | Provider/organization name |
| `provider_slug` | Provider slug (e.g., "openai") |
| `description` | Model description |
| `context_length` | Context window size in tokens |
| `prompt_price` | Price per 1M input tokens (USD) |
| `completion_price` | Price per 1M output tokens (USD) |
| `modality` | Input/output modality (e.g., "text->text") |
| `rank` | Model ranking/popularity |
| `source_gateway` | Source gateway (same as gateway column) |

## Example Output

```
gateway,id,name,provider,provider_slug,description,context_length,prompt_price,completion_price,modality,rank,source_gateway
openrouter,openai/gpt-4,OpenAI: GPT-4,,,GPT-4 is a large multimodal model...,8192,0.00003,0.00006,text+image->text,,openrouter
portkey,zai-org/GLM-4.5-Air,GLM-4.5-Air,zai-org,zai-org,Portkey catalog entry...,4096,/,/,text->text,,portkey
featherless,meta-llama/Llama-3-8b,Meta-Llama/Llama-3-8b,meta-llama,meta-llama,Featherless catalog entry...,8192,,,text->text,,featherless
```

## Current Statistics

**Last Export:** 2025-10-16

| Gateway | Count | With Pricing | Without Pricing |
|---------|-------|--------------|-----------------|
| OpenRouter | 339 | 339 | 0 |
| Portkey | 500 | 282 | 218 |
| Featherless | 6,418 | 3 | 6,415 |
| Chutes | 104 | 104 | 0 |
| Together | 100 | 100 | 0 |
| Fireworks | 38 | 0 | 38 |
| Groq | 19 | 0 | 19 |
| **DeepInfra** | **0*** | - | - |
| **TOTAL** | **7,518** | **828** | **6,690** |

*DeepInfra: 0 in export because cache wasn't populated at export time. Will show 182 models after backend restart.

## Data Accuracy Notes

### Pricing Data

- **OpenRouter**: Full pricing available for all models
- **Portkey**: Partial pricing (may be linked to provider costs)
- **Chutes**: Complete pricing information
- **Together**: Complete pricing information
- **Featherless**: Sparse pricing (most models not available through Featherless API)
- **Fireworks**: No pricing from API (requires manual lookup)
- **Groq**: No pricing from API
- **DeepInfra**: Pricing not available from API

### Gateway Status

- **Portkey API**: Returns 500 models (possible API limit)
  - Note: You mentioned ~895 Portkey models. The API may have limitations or the additional models might be inactive/archived.
  - If you have access to more models, please check Portkey documentation for pagination parameters.

## Requirements

- Backend must be running to populate the cache
- All gateway API keys must be configured in environment variables
- Models must be cached before export

## Troubleshooting

### No models exported

**Problem**: "No models found in cache"

**Solutions**:
1. Ensure the backend is running: `python -m src.main`
2. Wait for models to cache (first request to each gateway)
3. Check that all API keys are configured:
   ```
   OPENROUTER_API_KEY
   PORTKEY_API_KEY
   FEATHERLESS_API_KEY
   DEEPINFRA_API_KEY
   CHUTES_API_KEY
   GROQ_API_KEY
   FIREWORKS_API_KEY
   TOGETHER_API_KEY
   ```

### Missing models from a gateway

**Problem**: Expected gateway not showing in export

**Solutions**:
1. Verify API key is configured
2. Check backend logs for errors during cache population
3. Try manually calling the gateway endpoint to debug

## Using the Exported Data

### Excel/Google Sheets

1. Open the CSV file in Excel or Google Sheets
2. Use filters to find models by gateway, provider, or price range
3. Sort by context length, price, or ranking

### SQL Database

```sql
-- Import CSV to SQL
LOAD DATA INFILE 'models_export.csv'
INTO TABLE models
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

### Python Analysis

```python
import pandas as pd

df = pd.read_csv('models_export_2025-10-16_202520.csv')

# Find cheapest models
cheapest = df.nsmallest(5, 'prompt_price')

# Filter by gateway
portkey_models = df[df['gateway'] == 'portkey']

# Get pricing statistics
df.groupby('gateway')[['prompt_price', 'completion_price']].describe()
```

## Additional Resources

- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Portkey API Docs](https://docs.portkey.ai)
- [Featherless API Docs](https://docs.featherless.ai)
- [DeepInfra API Docs](https://deepinfra.com/docs)
- [Groq API Docs](https://console.groq.com/docs)
- [Fireworks API Docs](https://readme.fireworks.ai)
- [Together API Docs](https://docs.together.ai)

## Notes

- Export file is UTF-8 encoded
- Empty pricing fields appear as blank or "/" depending on gateway
- Context length of 0 may indicate the API doesn't provide this info
- Rank/ranking field may be empty if not provided by gateway
