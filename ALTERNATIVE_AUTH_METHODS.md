# Alternative Authentication Methods for Google Vertex AI

## 🚫 Issue: Service Account Key Creation Disabled

Your organization has the `iam.disableServiceAccountKeyCreation` policy enforced, which prevents creating JSON keys for service accounts.

**This is actually a GOOD security practice!** Keys can be leaked or stolen. Let's use more secure alternatives.

---

## ✅ Recommended Solutions (No Keys Required)

### Option 1: Workload Identity Federation (Best for Vercel/External Hosting) ⭐

Workload Identity Federation allows your application to authenticate without downloading keys.

#### For Vercel/Cloud Run/External Services:

1. **Create a Workload Identity Pool**

```bash
# Enable required APIs
gcloud services enable iamcredentials.googleapis.com \
  --project=gatewayz-468519

gcloud services enable sts.googleapis.com \
  --project=gatewayz-468519

# Create workload identity pool
gcloud iam workload-identity-pools create vercel-pool \
  --location="global" \
  --display-name="Vercel Workload Pool" \
  --project=gatewayz-468519
```

2. **Create a Provider for the Pool**

```bash
# For Vercel or generic OIDC
gcloud iam workload-identity-pools providers create-oidc vercel-provider \
  --location="global" \
  --workload-identity-pool="vercel-pool" \
  --issuer-uri="https://vercel.com/oauth" \
  --attribute-mapping="google.subject=assertion.sub" \
  --project=gatewayz-468519
```

3. **Grant Service Account Impersonation**

```bash
# Allow the workload identity to impersonate vertex-client
gcloud iam service-accounts add-iam-policy-binding \
  vertex-client@gatewayz-468519.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/963491462685/locations/global/workloadIdentityPools/vercel-pool/*" \
  --project=gatewayz-468519
```

---

### Option 2: Service Account Impersonation (Easiest) ⭐⭐⭐

Instead of using keys, one service account can impersonate another.

#### Step 1: Find Your Current Service Account

Your Vercel/hosting environment likely already has a default service account. Check which one is being used:

```bash
# If on Vercel, check the environment
# The default compute engine account might be available:
# 963491462685-compute@developer.gserviceaccount.com
```

#### Step 2: Grant Impersonation Permission

```bash
# Allow the compute engine SA to impersonate vertex-client
gcloud iam service-accounts add-iam-policy-binding \
  vertex-client@gatewayz-468519.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:963491462685-compute@developer.gserviceaccount.com" \
  --project=gatewayz-468519
```

#### Step 3: Update Your Code

Add this to `src/services/image_generation_client.py`:

```python
def make_google_vertex_image_request(
    prompt: str,
    model: str = "stable-diffusion-1.5",
    size: str = "1024x1024",
    n: int = 1,
    project_id: str = None,
    location: str = None,
    endpoint_id: str = None,
    **kwargs
) -> Dict[str, Any]:
    try:
        # Import Google Cloud AI Platform SDK
        try:
            from google.cloud import aiplatform
            from google.auth import impersonated_credentials
            from google.auth import default
        except ImportError:
            raise ImportError(
                "google-cloud-aiplatform package is required for Google Vertex AI integration. "
                "Install it with: pip install google-cloud-aiplatform"
            )

        # Use config values if not provided
        project_id = project_id or Config.GOOGLE_PROJECT_ID
        location = location or Config.GOOGLE_VERTEX_LOCATION
        endpoint_id = endpoint_id or Config.GOOGLE_VERTEX_ENDPOINT_ID

        # Get default credentials (from environment)
        source_credentials, _ = default()

        # Impersonate the vertex-client service account
        target_service_account = "vertex-client@gatewayz-468519.iam.gserviceaccount.com"
        target_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

        credentials = impersonated_credentials.Credentials(
            source_credentials=source_credentials,
            target_principal=target_service_account,
            target_scopes=target_scopes
        )

        # Initialize Vertex AI with impersonated credentials
        aiplatform.init(
            project=project_id,
            location=location,
            credentials=credentials
        )

        # Rest of the code remains the same...
        endpoint = aiplatform.Endpoint(endpoint_id)
        # ... etc
```

---

### Option 3: Request Organization Policy Exception

If you need traditional key-based auth, request an exception:

```bash
# Contact your Organization Policy Administrator and request:
# 1. Exception for service account: vertex-client@gatewayz-468519.iam.gserviceaccount.com
# 2. Reason: Vertex AI integration for production image generation
# 3. Policy to modify: iam.disableServiceAccountKeyCreation
```

---

### Option 4: Use Cloud Run or Cloud Functions (Google-Hosted)

If you deploy on Google Cloud infrastructure, authentication is automatic.

#### Deploy to Cloud Run:

```bash
# 1. Build container
docker build -t gcr.io/gatewayz-468519/gateway:latest .

# 2. Push to Google Container Registry
docker push gcr.io/gatewayz-468519/gateway:latest

# 3. Deploy to Cloud Run
gcloud run deploy gatewayz-api \
  --image=gcr.io/gatewayz-468519/gateway:latest \
  --platform=managed \
  --region=us-central1 \
  --service-account=vertex-client@gatewayz-468519.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --project=gatewayz-468519

# No credentials needed - automatic authentication! ✅
```

---

## 🎯 Recommended Approach for Your Setup

Based on your current stack (likely Vercel), here's what I recommend:

### **Use Service Account Impersonation** (Option 2)

This is the easiest and most secure option that doesn't require changing your hosting.

#### Quick Setup:

1. **Grant impersonation permission:**
```bash
gcloud iam service-accounts add-iam-policy-binding \
  vertex-client@gatewayz-468519.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:963491462685-compute@developer.gserviceaccount.com" \
  --project=gatewayz-468519
```

2. **Update your code** to use impersonation (see code above)

3. **Set environment variable on Vercel:**
```bash
GOOGLE_CLOUD_PROJECT=gatewayz-468519
GOOGLE_VERTEX_SERVICE_ACCOUNT=vertex-client@gatewayz-468519.iam.gserviceaccount.com
```

4. **Redeploy and test!**

---

## 🔧 Updated Code Implementation

Here's the complete updated function with impersonation support:

```python
# src/services/image_generation_client.py

def make_google_vertex_image_request(
    prompt: str,
    model: str = "stable-diffusion-1.5",
    size: str = "1024x1024",
    n: int = 1,
    project_id: str = None,
    location: str = None,
    endpoint_id: str = None,
    **kwargs
) -> Dict[str, Any]:
    """Make image generation request to Google Vertex AI endpoint using impersonation"""
    try:
        # Import required libraries
        try:
            from google.cloud import aiplatform
            from google.auth import impersonated_credentials, default
            import google.auth
        except ImportError:
            raise ImportError(
                "google-cloud-aiplatform package is required. "
                "Install with: pip install google-cloud-aiplatform google-auth"
            )

        # Use config values
        project_id = project_id or Config.GOOGLE_PROJECT_ID
        location = location or Config.GOOGLE_VERTEX_LOCATION
        endpoint_id = endpoint_id or Config.GOOGLE_VERTEX_ENDPOINT_ID

        # Service account to impersonate
        target_sa = os.getenv(
            "GOOGLE_VERTEX_SERVICE_ACCOUNT",
            "vertex-client@gatewayz-468519.iam.gserviceaccount.com"
        )

        logger.info(f"Authenticating to Vertex AI using service account impersonation: {target_sa}")

        try:
            # Get default credentials from environment
            source_credentials, source_project = default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )

            # Create impersonated credentials
            credentials = impersonated_credentials.Credentials(
                source_credentials=source_credentials,
                target_principal=target_sa,
                target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
                lifetime=3600  # 1 hour
            )

            logger.info(f"✓ Successfully created impersonated credentials")

        except Exception as auth_error:
            logger.error(f"Authentication failed: {auth_error}")
            raise ValueError(
                f"Failed to authenticate with Google Cloud. "
                f"Make sure the environment has default credentials and permission to impersonate {target_sa}. "
                f"Error: {auth_error}"
            )

        # Initialize Vertex AI
        aiplatform.init(
            project=project_id,
            location=location,
            credentials=credentials
        )

        # Get the endpoint
        endpoint = aiplatform.Endpoint(endpoint_id)

        # Parse size
        try:
            width, height = map(int, size.split('x'))
        except (ValueError, AttributeError):
            width, height = 512, 512

        # Prepare instances
        instances = []
        for _ in range(n):
            instance = {
                "prompt": prompt,
                "width": width,
                "height": height,
                **kwargs
            }
            instances.append(instance)

        # Make prediction
        logger.info(f"Making prediction request to endpoint {endpoint_id}")
        response = endpoint.predict(instances=instances)

        # Process response
        data = []
        if hasattr(response, 'predictions'):
            for prediction in response.predictions:
                if isinstance(prediction, dict):
                    image_b64 = prediction.get('image') or prediction.get('b64_json') or str(prediction)
                else:
                    image_b64 = str(prediction)

                data.append({
                    "b64_json": image_b64,
                    "url": None
                })

        return {
            "created": int(time.time()),
            "data": data,
            "provider": "google-vertex",
            "model": model
        }

    except Exception as e:
        logger.error(f"Google Vertex AI image generation request failed: {e}")
        raise
```

---

## 📋 Steps to Implement

### For Vercel Deployment:

1. **Grant impersonation permission** (run once):
```bash
gcloud iam service-accounts add-iam-policy-binding \
  vertex-client@gatewayz-468519.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:963491462685-compute@developer.gserviceaccount.com"
```

2. **Update the code** with the impersonation version above

3. **Set Vercel environment variables**:
```
GOOGLE_CLOUD_PROJECT=gatewayz-468519
GOOGLE_VERTEX_SERVICE_ACCOUNT=vertex-client@gatewayz-468519.iam.gserviceaccount.com
```

4. **Add to requirements.txt**:
```
google-auth>=2.0.0
```

5. **Deploy**:
```bash
git add .
git commit -m "feat: add service account impersonation for Vertex AI"
git push
```

---

## 🧪 Test After Implementation

```bash
curl -X POST https://api.gatewayz.ai/v1/images/generations \
  -H "Authorization: Bearer gw_live_hMdf3qaEzGnM1l3164lMjE0Q6pHVgKfmAoQEBgD67OA" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a serene mountain landscape at sunset",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex"
  }'
```

---

## ❓ Which Option Should You Choose?

| Option | Difficulty | Security | Best For |
|--------|-----------|----------|----------|
| **Service Account Impersonation** | Easy | ✅ High | Vercel, most hosting |
| Workload Identity Federation | Medium | ✅ Highest | Production deployments |
| Cloud Run | Easy | ✅ High | New deployments |
| Request Policy Exception | Easy | ⚠️ Lower | Last resort |

**Recommendation: Start with Service Account Impersonation** - It's the easiest to implement and very secure!

Let me know which option you'd like to pursue and I'll help you implement it! 🚀
