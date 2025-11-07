#!/usr/bin/env python3
"""
Verification script for Google Vertex AI Stable Diffusion v1.5 endpoint

This script checks if the endpoint is accessible and attempts to make a test prediction.
"""

import os
import sys

# Configuration from your setup
PROJECT_ID = "gatewayz-468519"
LOCATION = "us-central1"
ENDPOINT_ID = "6072619212881264640"

def check_google_credentials():
    """Check if Google Cloud credentials are configured"""
    print("=" * 80)
    print("STEP 1: Checking Google Cloud Credentials")
    print("=" * 80)

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if creds_path:
        print(f"✓ GOOGLE_APPLICATION_CREDENTIALS is set: {creds_path}")
        if os.path.exists(creds_path):
            print(f"✓ Credentials file exists")
            return True
        else:
            print(f"✗ Credentials file does NOT exist at: {creds_path}")
            return False
    else:
        print("✗ GOOGLE_APPLICATION_CREDENTIALS is NOT set")
        print("\nTo fix this, run:")
        print("  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json")
        return False

def check_vertex_ai_package():
    """Check if google-cloud-aiplatform is installed"""
    print("\n" + "=" * 80)
    print("STEP 2: Checking Google Cloud AI Platform SDK")
    print("=" * 80)

    try:
        import google.cloud.aiplatform as aiplatform
        print(f"✓ google-cloud-aiplatform is installed (version: {aiplatform.__version__})")
        return True
    except ImportError:
        print("✗ google-cloud-aiplatform is NOT installed")
        print("\nTo install it, run:")
        print("  pip install google-cloud-aiplatform")
        return False

def verify_endpoint_exists():
    """Verify the endpoint exists and get its details"""
    print("\n" + "=" * 80)
    print("STEP 3: Verifying Vertex AI Endpoint")
    print("=" * 80)

    try:
        from google.cloud import aiplatform

        print(f"Project ID: {PROJECT_ID}")
        print(f"Location: {LOCATION}")
        print(f"Endpoint ID: {ENDPOINT_ID}")
        print()

        # Initialize Vertex AI
        aiplatform.init(project=PROJECT_ID, location=LOCATION)
        print("✓ Vertex AI initialized successfully")

        # Get the endpoint
        endpoint = aiplatform.Endpoint(ENDPOINT_ID)
        print(f"✓ Endpoint found: {endpoint.display_name if hasattr(endpoint, 'display_name') else 'N/A'}")
        print(f"  Resource name: {endpoint.resource_name}")

        # Get endpoint details
        if hasattr(endpoint, 'gca_resource'):
            gca = endpoint.gca_resource
            if hasattr(gca, 'deploy_state'):
                print(f"  Deploy state: {gca.deploy_state}")
            if hasattr(gca, 'deployed_models'):
                print(f"  Deployed models: {len(gca.deployed_models)}")
                for model in gca.deployed_models:
                    if hasattr(model, 'id'):
                        print(f"    - Model ID: {model.id}")

        return endpoint

    except Exception as e:
        print(f"✗ Error accessing endpoint: {e}")
        print(f"\nError type: {type(e).__name__}")
        print(f"Error details: {str(e)}")
        return None

def test_prediction(endpoint):
    """Test making a prediction"""
    print("\n" + "=" * 80)
    print("STEP 4: Testing Prediction")
    print("=" * 80)

    try:
        # Prepare test instance
        test_prompt = "a beautiful mountain landscape"
        instance = {
            "prompt": test_prompt,
            "width": 512,
            "height": 512
        }

        print(f"Test prompt: '{test_prompt}'")
        print(f"Instance format: {instance}")
        print()
        print("Making prediction request...")

        # Make prediction
        response = endpoint.predict(instances=[instance])

        print("✓ Prediction successful!")
        print(f"  Response type: {type(response)}")

        if hasattr(response, 'predictions'):
            print(f"  Number of predictions: {len(response.predictions)}")

            # Check the format of the first prediction
            if len(response.predictions) > 0:
                first_pred = response.predictions[0]
                print(f"  Prediction type: {type(first_pred)}")

                if isinstance(first_pred, dict):
                    print(f"  Prediction keys: {list(first_pred.keys())}")

                    # Check for image data
                    if 'image' in first_pred:
                        print(f"  ✓ Image data found (length: {len(str(first_pred['image']))} chars)")
                    elif 'b64_json' in first_pred:
                        print(f"  ✓ Base64 image data found (length: {len(first_pred['b64_json'])} chars)")
                    else:
                        print(f"  First prediction content: {str(first_pred)[:200]}...")
                else:
                    print(f"  Prediction content (first 200 chars): {str(first_pred)[:200]}")

        return True

    except Exception as e:
        print(f"✗ Prediction failed: {e}")
        print(f"\nError type: {type(e).__name__}")
        print(f"Error details: {str(e)}")

        # Provide helpful debugging info
        if "permission" in str(e).lower():
            print("\n💡 This looks like a permissions error. Make sure your service account has:")
            print("   - Vertex AI User role")
            print("   - Access to the endpoint")
        elif "not found" in str(e).lower():
            print("\n💡 The endpoint might not exist or might be in a different project/region")
        elif "invalid" in str(e).lower():
            print("\n💡 The instance format might not match what the model expects")
            print("   Try checking the model's input schema in the Vertex AI console")

        return False

def main():
    """Main verification flow"""
    print("\n🔍 Google Vertex AI Stable Diffusion v1.5 Endpoint Verification")
    print("=" * 80)

    # Step 1: Check credentials
    if not check_google_credentials():
        print("\n❌ VERIFICATION FAILED: Google Cloud credentials not configured")
        sys.exit(1)

    # Step 2: Check package
    if not check_vertex_ai_package():
        print("\n❌ VERIFICATION FAILED: Required package not installed")
        sys.exit(1)

    # Step 3: Verify endpoint
    endpoint = verify_endpoint_exists()
    if not endpoint:
        print("\n❌ VERIFICATION FAILED: Could not access endpoint")
        sys.exit(1)

    # Step 4: Test prediction
    if not test_prediction(endpoint):
        print("\n⚠️  VERIFICATION PARTIAL: Endpoint exists but prediction failed")
        print("\nThis could mean:")
        print("  1. The instance format needs adjustment")
        print("  2. The model needs different input parameters")
        print("  3. There's a permissions issue")
        sys.exit(1)

    # Success!
    print("\n" + "=" * 80)
    print("✅ VERIFICATION COMPLETE: Endpoint is working correctly!")
    print("=" * 80)
    print("\nYou can now use the endpoint with your AI Gateway.")
    print("The endpoint is accessible and responding to predictions.")

if __name__ == "__main__":
    main()
