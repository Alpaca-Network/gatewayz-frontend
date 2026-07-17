#!/bin/bash
#
# Test Tool Calling with curl
# This script demonstrates tool calling using a simple curl command
#
# Usage:
#   export GATEWAYZ_API_KEY="your_api_key_here"
#   bash test-tool-calling-curl.sh
#

if [ -z "$GATEWAYZ_API_KEY" ]; then
  echo "❌ Error: GATEWAYZ_API_KEY environment variable is required"
  echo ""
  echo "Usage:"
  echo "  export GATEWAYZ_API_KEY=\"your_api_key_here\""
  echo "  bash test-tool-calling-curl.sh"
  exit 1
fi

API_URL="${NEXT_PUBLIC_API_BASE_URL:-https://api.gatewayz.ai}"

echo "🧪 Testing Tool Calling with curl"
echo "API: $API_URL"
echo "Model: Qwen: Qwen2 72B A16B 2507 (FREE)"
echo "Prompt: What's the weather like in Paris?"
echo ""

curl -X POST "$API_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  -d '{
    "model": "Qwen: Qwen2 72B A16B 2507",
    "messages": [
      {
        "role": "user",
        "content": "What'\''s the weather like in Paris?"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather in a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"]
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto",
    "temperature": 0.7,
    "max_tokens": 500
  }' | jq '.'

echo ""
echo "✨ Done! Check the response above for tool_calls"
