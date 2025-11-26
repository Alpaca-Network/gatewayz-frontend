#!/bin/bash

# Script to fetch common Sentry errors using curl
#
# Usage:
#   1. Set your environment variables:
#      export SENTRY_AUTH_TOKEN="your-token-here"
#      export SENTRY_ORG="your-org-slug"
#      export SENTRY_PROJECT="your-project-slug"
#   2. Run: bash scripts/fetch-sentry-errors.sh

set -e

# Check for required environment variables
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "❌ Error: SENTRY_AUTH_TOKEN environment variable is required"
  echo "Get your auth token from: https://sentry.io/settings/account/api/auth-tokens/"
  exit 1
fi

if [ -z "$SENTRY_ORG" ]; then
  echo "❌ Error: SENTRY_ORG environment variable is required"
  echo "Example: export SENTRY_ORG='my-organization'"
  exit 1
fi

if [ -z "$SENTRY_PROJECT" ]; then
  echo "❌ Error: SENTRY_PROJECT environment variable is required"
  echo "Example: export SENTRY_PROJECT='my-project'"
  exit 1
fi

DAYS_BACK=${DAYS_BACK:-7}

echo "🔍 Fetching Sentry issues from the last ${DAYS_BACK} days..."
echo "Organization: $SENTRY_ORG"
echo "Project: $SENTRY_PROJECT"
echo ""

# Fetch issues
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?statsPeriod=${DAYS_BACK}d&sort=freq")

# Extract HTTP status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Error: Sentry API returned status code $HTTP_CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

# Parse and display results
echo "✅ Successfully fetched Sentry issues"
echo ""
echo "=================================================="
echo "  TOP 10 MOST FREQUENT ERRORS"
echo "=================================================="
echo ""

# Check if jq is available for pretty formatting
if command -v jq &> /dev/null; then
  echo "$BODY" | jq -r '
    sort_by(-.count) |
    .[:10] |
    to_entries |
    .[] |
    "\n[\(.key + 1)]\n" +
    "  Title:       \(.value.title)\n" +
    "  Issue ID:    \(.value.shortId)\n" +
    "  Events:      \(.value.count // 0)\n" +
    "  Users:       \(.value.userCount // 0)\n" +
    "  Level:       \(.value.level)\n" +
    "  Status:      \(.value.status)\n" +
    "  First Seen:  \(.value.firstSeen)\n" +
    "  Last Seen:   \(.value.lastSeen)\n" +
    "  Link:        \(.value.permalink)\n" +
    "  Location:    \(.value.culprit // "N/A")"
  '
else
  echo "⚠️  Install 'jq' for better formatting: brew install jq (macOS) or apt-get install jq (Linux)"
  echo ""
  echo "$BODY"
fi

echo ""
echo "=================================================="
echo ""

# Save raw data to file
OUTPUT_FILE="sentry-errors-$(date +%Y%m%d-%H%M%S).json"
echo "$BODY" > "$OUTPUT_FILE"
echo "📁 Raw data saved to: $OUTPUT_FILE"
echo ""
echo "To analyze further, you can use jq:"
echo "  jq '.[] | select(.level == \"error\")' $OUTPUT_FILE"
echo "  jq '.[] | select(.tags[].key == \"api_route\")' $OUTPUT_FILE"
echo ""
