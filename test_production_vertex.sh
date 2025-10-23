#!/bin/bash
#
# Test Google Vertex AI Stable Diffusion v1.5 through Gatewayz Production API
#
# Usage:
#   export GATEWAYZ_API_KEY="your-api-key"
#   ./test_production_vertex.sh
#

set -e

# Configuration
API_URL="https://api.gatewayz.ai"
ENDPOINT="/v1/images/generations"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================================================"
echo "Testing Google Vertex AI Stable Diffusion v1.5"
echo "========================================================================"
echo ""

# Check if API key is set
if [ -z "$GATEWAYZ_API_KEY" ]; then
    echo -e "${RED}ERROR: GATEWAYZ_API_KEY environment variable is not set${NC}"
    echo ""
    echo "To get your API key:"
    echo "  1. Visit https://gatewayz.ai"
    echo "  2. Log in to your account"
    echo "  3. Go to Settings > API Keys"
    echo "  4. Copy your API key"
    echo ""
    echo "Then run:"
    echo "  export GATEWAYZ_API_KEY='your-api-key'"
    echo "  ./test_production_vertex.sh"
    echo ""
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  API URL: $API_URL"
echo "  Endpoint: $ENDPOINT"
echo "  API Key: ${GATEWAYZ_API_KEY:0:10}..."
echo ""

# Step 1: Check API health
echo -e "${BLUE}Step 1: Checking API health...${NC}"
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
echo "$HEALTH_RESPONSE" | jq .

if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
    exit 1
fi
echo ""

# Step 2: Check user balance
echo -e "${BLUE}Step 2: Checking account balance...${NC}"
BALANCE_RESPONSE=$(curl -s -H "Authorization: Bearer $GATEWAYZ_API_KEY" "$API_URL/user/balance")
echo "$BALANCE_RESPONSE" | jq .

CREDITS=$(echo "$BALANCE_RESPONSE" | jq -r '.credits // 0')
if [ "$CREDITS" -lt 100 ]; then
    echo -e "${YELLOW}⚠ Warning: Low credits ($CREDITS). Image generation costs ~100 credits.${NC}"
    echo "  Add credits at: https://gatewayz.ai/pricing"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Sufficient credits: $CREDITS${NC}"
fi
echo ""

# Step 3: Test Google Vertex AI image generation
echo -e "${BLUE}Step 3: Testing Google Vertex AI image generation...${NC}"
echo "  Prompt: 'a serene mountain landscape at sunset, photorealistic'"
echo "  Model: stable-diffusion-1.5"
echo "  Size: 512x512"
echo "  Provider: google-vertex"
echo ""

REQUEST_PAYLOAD='{
  "prompt": "a serene mountain landscape at sunset, photorealistic, 4k quality",
  "model": "stable-diffusion-1.5",
  "size": "512x512",
  "n": 1,
  "provider": "google-vertex"
}'

echo "Request payload:"
echo "$REQUEST_PAYLOAD" | jq .
echo ""

echo "Sending request (this may take 5-15 seconds)..."
START_TIME=$(date +%s)

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL$ENDPOINT" \
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_PAYLOAD")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Extract HTTP status and response body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo ""
echo -e "${BLUE}Response (took ${DURATION}s):${NC}"
echo "HTTP Status: $HTTP_STATUS"
echo ""

# Check HTTP status
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Request successful!${NC}"
    echo ""

    # Parse response
    echo "Response details:"
    echo "$RESPONSE_BODY" | jq 'del(.data[].b64_json)'  # Show response without huge base64 data
    echo ""

    # Check if image data exists
    IMAGE_COUNT=$(echo "$RESPONSE_BODY" | jq '.data | length')
    echo "Images generated: $IMAGE_COUNT"

    if [ "$IMAGE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Image data received${NC}"

        # Check gateway usage
        TOKENS_CHARGED=$(echo "$RESPONSE_BODY" | jq -r '.gateway_usage.tokens_charged // "N/A"')
        REQUEST_MS=$(echo "$RESPONSE_BODY" | jq -r '.gateway_usage.request_ms // "N/A"')
        BALANCE_AFTER=$(echo "$RESPONSE_BODY" | jq -r '.gateway_usage.user_balance_after // "N/A"')

        echo ""
        echo "Gateway Usage:"
        echo "  Tokens charged: $TOKENS_CHARGED"
        echo "  Request time: ${REQUEST_MS}ms"
        echo "  Balance after: $BALANCE_AFTER"

        # Save image
        echo ""
        echo "Saving image..."
        IMAGE_B64=$(echo "$RESPONSE_BODY" | jq -r '.data[0].b64_json')

        if [ "$IMAGE_B64" != "null" ] && [ -n "$IMAGE_B64" ]; then
            OUTPUT_FILE="vertex_test_$(date +%Y%m%d_%H%M%S).png"
            echo "$IMAGE_B64" | base64 -d > "$OUTPUT_FILE"

            if [ -f "$OUTPUT_FILE" ]; then
                FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
                echo -e "${GREEN}✓ Image saved to: $OUTPUT_FILE (${FILE_SIZE} bytes)${NC}"

                # Try to display file info
                if command -v file &> /dev/null; then
                    echo "  File type: $(file -b "$OUTPUT_FILE")"
                fi
            else
                echo -e "${RED}✗ Failed to save image${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ No base64 image data in response${NC}"
        fi
    else
        echo -e "${RED}✗ No images in response${NC}"
    fi

    echo ""
    echo -e "${GREEN}========================================================================"
    echo "TEST PASSED: Google Vertex AI endpoint is working!"
    echo -e "========================================================================${NC}"

elif [ "$HTTP_STATUS" = "402" ]; then
    echo -e "${RED}✗ Insufficient credits${NC}"
    echo ""
    echo "$RESPONSE_BODY" | jq .
    echo ""
    echo "Add credits at: https://gatewayz.ai/pricing"
    exit 1

elif [ "$HTTP_STATUS" = "401" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo ""
    echo "$RESPONSE_BODY" | jq .
    echo ""
    echo "Check your API key at: https://gatewayz.ai/settings"
    exit 1

elif [ "$HTTP_STATUS" = "500" ]; then
    echo -e "${RED}✗ Server error${NC}"
    echo ""
    echo "$RESPONSE_BODY" | jq .
    echo ""
    echo "This could mean:"
    echo "  1. Google Cloud credentials are not configured on the server"
    echo "  2. The Vertex AI endpoint is not accessible"
    echo "  3. There's an issue with the model deployment"
    echo ""
    echo "Error details:"
    ERROR_MSG=$(echo "$RESPONSE_BODY" | jq -r '.detail // .error // "Unknown error"')
    echo "  $ERROR_MSG"
    exit 1

else
    echo -e "${RED}✗ Request failed${NC}"
    echo ""
    echo "$RESPONSE_BODY" | jq .
    exit 1
fi
