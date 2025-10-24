#!/bin/bash
#
# Check Google Cloud Service Accounts for Vertex AI Access
#
# This script lists all service accounts in your project and checks
# which ones have Vertex AI permissions.
#

set -e

PROJECT_ID="gatewayz-468519"

echo "========================================================================"
echo "Checking Service Accounts in Project: $PROJECT_ID"
echo "========================================================================"
echo ""

# Check if gcloud is configured
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID 2>/dev/null

echo "Fetching service accounts..."
echo ""

# Get all service accounts
SA_LIST=$(gcloud iam service-accounts list --format="value(email)" 2>/dev/null)

if [ -z "$SA_LIST" ]; then
    echo "No service accounts found or authentication failed"
    echo ""
    echo "Authenticate with:"
    echo "  gcloud auth login"
    exit 1
fi

# Counter
COUNT=0

# Check each service account
while IFS= read -r SA_EMAIL; do
    COUNT=$((COUNT + 1))

    echo "========================================================================"
    echo "Service Account #$COUNT"
    echo "========================================================================"
    echo "Email: $SA_EMAIL"
    echo ""

    # Get service account details
    SA_INFO=$(gcloud iam service-accounts describe "$SA_EMAIL" 2>/dev/null)

    # Extract display name
    DISPLAY_NAME=$(echo "$SA_INFO" | grep "displayName:" | cut -d':' -f2- | xargs)
    if [ -n "$DISPLAY_NAME" ]; then
        echo "Display Name: $DISPLAY_NAME"
    fi

    # Check if disabled
    DISABLED=$(echo "$SA_INFO" | grep "disabled:" | cut -d':' -f2 | xargs)
    if [ "$DISABLED" = "true" ]; then
        echo "Status: ⛔ DISABLED - Cannot use this account"
        echo ""
        continue
    else
        echo "Status: ✅ ENABLED"
    fi

    echo ""
    echo "Roles assigned to this service account:"

    # Get IAM policy for this service account
    ROLES=$(gcloud projects get-iam-policy $PROJECT_ID \
        --flatten="bindings[].members" \
        --filter="bindings.members:serviceAccount:$SA_EMAIL" \
        --format="value(bindings.role)" 2>/dev/null | sort -u)

    if [ -z "$ROLES" ]; then
        echo "  ❌ No roles assigned"
        echo ""
        continue
    fi

    # Check for Vertex AI roles
    HAS_VERTEX=false

    while IFS= read -r ROLE; do
        # Simplify role name
        SIMPLE_ROLE=$(echo "$ROLE" | sed 's/roles\///')

        # Check if it's a Vertex AI role
        if [[ "$ROLE" == *"aiplatform"* ]] || [[ "$ROLE" == *"ml."* ]]; then
            echo "  ✅ $SIMPLE_ROLE (VERTEX AI ROLE)"
            HAS_VERTEX=true
        elif [[ "$ROLE" == "roles/editor" ]] || [[ "$ROLE" == "roles/owner" ]]; then
            echo "  ⚠️  $SIMPLE_ROLE (BROAD ROLE - has Vertex AI access)"
            HAS_VERTEX=true
        else
            echo "  - $SIMPLE_ROLE"
        fi
    done <<< "$ROLES"

    echo ""

    # Recommendation
    if [ "$HAS_VERTEX" = true ]; then
        echo "✅ RECOMMENDATION: This account CAN be used for Vertex AI!"
        echo ""
        echo "To get the JSON key for this account:"
        echo "  gcloud iam service-accounts keys create vertex-key.json \\"
        echo "    --iam-account=\"$SA_EMAIL\""
        echo ""
    else
        echo "❌ RECOMMENDATION: This account cannot access Vertex AI"
        echo "   Need to add roles/aiplatform.user role"
        echo ""
    fi

done <<< "$SA_LIST"

echo "========================================================================"
echo "Summary: Found $COUNT service account(s)"
echo "========================================================================"
echo ""
echo "To create a new service account with Vertex AI access:"
echo ""
echo "  gcloud iam service-accounts create vertex-ai-gateway \\"
echo "    --display-name=\"Vertex AI Gateway\" \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "  gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "    --member=\"serviceAccount:vertex-ai-gateway@$PROJECT_ID.iam.gserviceaccount.com\" \\"
echo "    --role=\"roles/aiplatform.user\""
echo ""
echo "  gcloud iam service-accounts keys create vertex-key.json \\"
echo "    --iam-account=\"vertex-ai-gateway@$PROJECT_ID.iam.gserviceaccount.com\""
echo ""
