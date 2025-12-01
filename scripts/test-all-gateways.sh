#!/bin/bash
set -euo pipefail

# Script to test all model provider gateways and report their status
# This helps identify which providers are active and working

API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://api.gatewayz.ai}"
TIMEOUT=30
LIMIT=5

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Array of all gateways to test
GATEWAYS=(
    "openrouter"
    "featherless"
    "groq"
    "together"
    "fireworks"
    "chutes"
    "deepinfra"
    "google"
    "cerebras"
    "nebius"
    "xai"
    "novita"
    "huggingface"
    "aimo"
    "near"
    "fal"
    "vercel-ai-gateway"
    "helicone"
    "alpaca"
    "alibaba"
    "clarifai"
)

echo "======================================"
echo "Testing All Model Provider Gateways"
echo "======================================"
echo ""
echo "API Base URL: $API_BASE_URL"
echo "Timeout: ${TIMEOUT}s"
echo "Limit: $LIMIT models per gateway"
echo ""

# Counters
TOTAL=${#GATEWAYS[@]}
WORKING=0
FAILED=0
SLOW=0

# Results storage
declare -a WORKING_GATEWAYS=()
declare -a FAILED_GATEWAYS=()
declare -a SLOW_GATEWAYS=()

echo "Testing $TOTAL gateways..."
echo ""

for gateway in "${GATEWAYS[@]}"; do
    printf "%-25s ... " "$gateway"

    START_TIME=$(date +%s%N)

    # Test the gateway with timeout
    RESPONSE=$(timeout $TIMEOUT curl -s "${API_BASE_URL}/v1/models?gateway=${gateway}&limit=${LIMIT}" 2>&1 || echo "TIMEOUT")

    END_TIME=$(date +%s%N)
    ELAPSED=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds

    if [[ "$RESPONSE" == "TIMEOUT" ]] || [[ "$RESPONSE" == "" ]]; then
        echo -e "${YELLOW}TIMEOUT${NC} (>${TIMEOUT}s)"
        SLOW_GATEWAYS+=("$gateway")
        ((SLOW++))
    elif echo "$RESPONSE" | grep -q '"data"'; then
        # Count models returned
        MODEL_COUNT=$(echo "$RESPONSE" | grep -o '"id":' | wc -l)

        if [ "$MODEL_COUNT" -gt 0 ]; then
            if [ "$ELAPSED" -gt 10000 ]; then
                echo -e "${GREEN}WORKING${NC} (${MODEL_COUNT} models, ${ELAPSED}ms) - SLOW"
                WORKING_GATEWAYS+=("$gateway")
                ((WORKING++))
            else
                echo -e "${GREEN}WORKING${NC} (${MODEL_COUNT} models, ${ELAPSED}ms)"
                WORKING_GATEWAYS+=("$gateway")
                ((WORKING++))
            fi
        else
            echo -e "${YELLOW}EMPTY${NC} (0 models, ${ELAPSED}ms)"
            FAILED_GATEWAYS+=("$gateway (empty)")
            ((FAILED++))
        fi
    else
        # Check for error messages
        if echo "$RESPONSE" | grep -q '"detail"'; then
            ERROR=$(echo "$RESPONSE" | grep -o '"detail":"[^"]*"' | head -1)
            echo -e "${RED}ERROR${NC} ($ERROR)"
        else
            echo -e "${RED}FAILED${NC} (${ELAPSED}ms)"
        fi
        FAILED_GATEWAYS+=("$gateway")
        ((FAILED++))
    fi
done

echo ""
echo "======================================"
echo "Summary"
echo "======================================"
echo ""
echo -e "Total Gateways:    $TOTAL"
echo -e "${GREEN}Working:           $WORKING${NC}"
echo -e "${RED}Failed:            $FAILED${NC}"
echo -e "${YELLOW}Timeout/Slow:      $SLOW${NC}"
echo ""

if [ ${#WORKING_GATEWAYS[@]} -gt 0 ]; then
    echo "Working Gateways:"
    for gw in "${WORKING_GATEWAYS[@]}"; do
        echo "  ✓ $gw"
    done
    echo ""
fi

if [ ${#FAILED_GATEWAYS[@]} -gt 0 ]; then
    echo "Failed Gateways:"
    for gw in "${FAILED_GATEWAYS[@]}"; do
        echo "  ✗ $gw"
    done
    echo ""
fi

if [ ${#SLOW_GATEWAYS[@]} -gt 0 ]; then
    echo "Timeout/Slow Gateways:"
    for gw in "${SLOW_GATEWAYS[@]}"; do
        echo "  ⏱ $gw"
    done
    echo ""
fi

# Exit with success if at least half are working
if [ "$WORKING" -ge $(( TOTAL / 2 )) ]; then
    echo -e "${GREEN}✓ Majority of gateways are working ($WORKING/$TOTAL)${NC}"
    exit 0
else
    echo -e "${RED}✗ Most gateways are not working ($WORKING/$TOTAL)${NC}"
    exit 1
fi
