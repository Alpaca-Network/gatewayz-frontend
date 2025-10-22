#!/usr/bin/env python3
"""
Test script for Google Vertex AI image generation endpoint

This script demonstrates how to call the AI Gateway's image generation endpoint
with the Google Vertex AI provider for Stability Diffusion v1.5.

Requirements:
- Set GATEWAY_API_KEY environment variable with your API key
- Ensure Google Cloud credentials are configured (GOOGLE_APPLICATION_CREDENTIALS)
- The Vertex AI endpoint must be deployed and active

Usage:
    export GATEWAY_API_KEY="your-api-key"
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
    python test_google_vertex_endpoint.py
"""

import os
import json
import requests
import base64
from pathlib import Path

# Configuration
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8000")
API_KEY = os.getenv("GATEWAY_API_KEY")

if not API_KEY:
    raise ValueError("GATEWAY_API_KEY environment variable must be set")


def test_google_vertex_image_generation():
    """Test image generation with Google Vertex AI provider"""

    # Endpoint URL
    url = f"{GATEWAY_URL}/v1/images/generations"

    # Headers
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # Request payload
    payload = {
        "prompt": "A serene mountain landscape at sunset, photorealistic, 4k quality",
        "model": "stable-diffusion-1.5",
        "size": "512x512",  # Stable Diffusion 1.5 typically uses 512x512
        "n": 1,
        "provider": "google-vertex",
        "google_project_id": "963491462685",  # Your Google Cloud project ID
        "google_location": "us-central1",  # Your endpoint location
        "google_endpoint_id": "1724873159724761088"  # Your endpoint ID
    }

    print("Sending request to Google Vertex AI endpoint...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print()

    try:
        # Make request
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        # Check response
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("Success!")
            print(f"\nResponse:")
            print(f"  Created: {result.get('created')}")
            print(f"  Provider: {result.get('provider')}")
            print(f"  Model: {result.get('model')}")
            print(f"  Images generated: {len(result.get('data', []))}")

            # Check gateway usage info
            if 'gateway_usage' in result:
                usage = result['gateway_usage']
                print(f"\nGateway Usage:")
                print(f"  Tokens charged: {usage.get('tokens_charged')}")
                print(f"  Request time: {usage.get('request_ms')} ms")
                print(f"  Balance after: {usage.get('user_balance_after')}")
                print(f"  Images generated: {usage.get('images_generated')}")

            # Save images if base64 data is present
            for i, image_data in enumerate(result.get('data', [])):
                if image_data.get('b64_json'):
                    output_path = f"generated_image_{i+1}.png"
                    image_bytes = base64.b64decode(image_data['b64_json'])
                    Path(output_path).write_bytes(image_bytes)
                    print(f"\nSaved image to: {output_path}")
                elif image_data.get('url'):
                    print(f"\nImage URL: {image_data['url']}")
        else:
            print("Error!")
            print(f"Response: {response.text}")

    except requests.exceptions.Timeout:
        print("Error: Request timed out after 120 seconds")
    except requests.exceptions.RequestException as e:
        print(f"Error: Request failed - {e}")
    except Exception as e:
        print(f"Error: {e}")


def test_with_custom_parameters():
    """Test with additional Stability Diffusion parameters"""

    url = f"{GATEWAY_URL}/v1/images/generations"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # Request with additional parameters
    payload = {
        "prompt": "A futuristic cityscape with flying cars, cyberpunk style",
        "model": "stable-diffusion-1.5",
        "size": "512x512",
        "n": 2,  # Generate 2 images
        "provider": "google-vertex",
        "google_project_id": "963491462685",
        "google_location": "us-central1",
        "google_endpoint_id": "1724873159724761088",
        # Additional Stability Diffusion parameters (if supported by your deployment)
        "num_inference_steps": 50,
        "guidance_scale": 7.5,
        "negative_prompt": "blurry, low quality, distorted"
    }

    print("\n" + "="*80)
    print("Testing with custom parameters...")
    print("="*80)
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print()

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=180)

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("Success!")
            print(f"Images generated: {len(result.get('data', []))}")

            # Save images
            for i, image_data in enumerate(result.get('data', [])):
                if image_data.get('b64_json'):
                    output_path = f"custom_image_{i+1}.png"
                    image_bytes = base64.b64decode(image_data['b64_json'])
                    Path(output_path).write_bytes(image_bytes)
                    print(f"Saved image to: {output_path}")
        else:
            print("Error!")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print("="*80)
    print("Google Vertex AI Image Generation Test")
    print("="*80)
    print()

    # Run basic test
    test_google_vertex_image_generation()

    # Uncomment to test with custom parameters
    # test_with_custom_parameters()
