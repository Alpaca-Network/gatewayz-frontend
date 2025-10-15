# Frontend Model URL - Use Literal Slashes

## Desired Behavior
**Use literal slashes in model URLs for cleaner, more readable URLs**

✅ **Desired (Clean):**
```
https://beta.gatewayz.ai/models/zai-org/GLM-4.5-Air
https://beta.gatewayz.ai/models/x-ai/grok-4-fast
https://beta.gatewayz.ai/models/openai/gpt-4
```

❌ **Current (URL-encoded):**
```
https://beta.gatewayz.ai/models/zai-org%2FGLM-4.5-Air
https://beta.gatewayz.ai/models/x-ai%2Fgrok-4-fast
https://beta.gatewayz.ai/models/openai%2Fgpt-4
```

## Why This Matters
- **SEO:** Search engines prefer clean, readable URLs
- **Shareability:** Users can easily read and share links
- **Consistency:** Matches REST API conventions (`/provider/model`)
- **Debugging:** Easier to spot issues in URLs

## Frontend Solution

### React Router Configuration

Update your route configuration to handle slashes correctly:

```typescript
// BEFORE (causes %2F encoding)
<Route path="/models/:modelId" element={<ModelPage />} />

// AFTER (allows literal slashes)
<Route path="/models/:provider/:modelName" element={<ModelPage />} />
```

### Link Generation

When creating links to model pages:

```typescript
// BEFORE ❌
const modelLink = `/models/${encodeURIComponent(model.id)}`;
// Results in: /models/zai-org%2FGLM-4.5-Air

// AFTER ✅
const [provider, modelName] = model.id.split('/', 2);
const modelLink = `/models/${provider}/${modelName}`;
// Results in: /models/zai-org/GLM-4.5-Air

// OR even simpler ✅
const modelLink = `/models/${model.id}`;
// Let the router handle it naturally
```

### Model Page Component

Update your model page to extract both parameters:

```typescript
// BEFORE
function ModelPage() {
  const { modelId } = useParams(); // Gets "zai-org%2FGLM-4.5-Air"
  const fullModelId = decodeURIComponent(modelId);
  // ...
}

// AFTER
function ModelPage() {
  const { provider, modelName } = useParams(); // Gets both separately
  const fullModelId = `${provider}/${modelName}`;
  // ...
}
```

## Next.js Configuration

If using Next.js, update your dynamic routes:

```
// BEFORE
pages/models/[modelId].tsx

// AFTER  
pages/models/[provider]/[modelName].tsx
```

Then access in component:
```typescript
import { useRouter } from 'next/router';

function ModelPage() {
  const router = useRouter();
  const { provider, modelName } = router.query;
  const fullModelId = `${provider}/${modelName}`;
  // ...
}
```

## Backend Support

The backend already supports both formats:

✅ **Works:** `/catalog/model/zai-org/GLM-4.5-Air`
✅ **Works:** `/catalog/model/zai-org%2FGLM-4.5-Air`

Backend route definition:
```python
@router.get("/model/{provider_name:path}/{model_name:path}")
```

The `:path` modifier allows slashes, so both encoded and literal work.

## Testing Checklist

After implementing changes:

- [ ] All model links use literal slashes
- [ ] Direct URL navigation works: `/models/zai-org/GLM-4.5-Air`
- [ ] URL bar shows clean paths (no %2F)
- [ ] Browser back/forward buttons work correctly
- [ ] Sharing URLs produces clean links
- [ ] SEO meta tags use clean URLs

## Example Implementation

Complete example for a model list component:

```typescript
import { Link } from 'react-router-dom';

interface Model {
  id: string; // e.g., "zai-org/GLM-4.5-Air"
  name: string;
}

function ModelList({ models }: { models: Model[] }) {
  return (
    <div>
      {models.map(model => {
        // Split model ID into provider and model name
        const [provider, ...modelParts] = model.id.split('/');
        const modelName = modelParts.join('/'); // Handle models with multiple slashes
        
        return (
          <Link 
            key={model.id}
            to={`/models/${provider}/${modelName}`}
          >
            {model.name}
          </Link>
        );
      })}
    </div>
  );
}
```

## Summary

**Changes Required:**
1. ✅ Update route configuration to use two parameters: `/:provider/:modelName`
2. ✅ Update link generation to split model ID and construct clean URLs
3. ✅ Update model page component to read both parameters
4. ✅ Test all model links work with literal slashes

**Benefits:**
- Cleaner, more professional URLs
- Better SEO
- Easier debugging
- Follows REST conventions

The backend already supports this - no backend changes needed!