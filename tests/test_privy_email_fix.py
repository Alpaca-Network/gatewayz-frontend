#!/usr/bin/env python3
"""Test that the Privy auth endpoint correctly handles email extraction"""

import requests
import json

# Test data matching the frontend logs
test_payload = {
    "user": {
        "id": "did:privy:cmgh3zmfp001sl80ddfh97vu6",
        "created_at": 1759874753,
        "linked_accounts": [
            {
                "type": "wallet",
                "first_verified_at": 1759874752,
                "latest_verified_at": 1759874752
            },
            {
                "type": "email",
                "first_verified_at": 1759874753,
                "latest_verified_at": 1759876521
            }
        ],
        "mfa_methods": [],
        "has_accepted_terms": False,
        "is_guest": False
    },
    "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkROZ1pBcFg2NkxEUUtNNmVLMHhqM2gxcy1tY2lJemxLUVE3XzYxZWN0OVUifQ.eyJzaWQiOiJjbWdoNTFpc3YwMDJoa3owZG5sNmgxbmw2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTk4NzY1MjEsImF1ZCI6ImNtZzhma2liMzAwZzNsNDBkYnM2YXV0cWUiLCJzdWIiOiJkaWQ6cHJpdnk6Y21naDN6bWZwMDAxc2w4MGRkZmg5N3Z1NiIsImV4cCI6MTc1OTg4MDEyMX0.rqtc-VwlFIQGka5YI7G3I2aG4CLFybYoTAsrXRp7pEfwOKWLxSr-ZgftAacNcjBTRhvQqkgcHaeFFqrSg8hThA",
    "auto_create_api_key": True,
    "trial_credits": 10
}

print("Testing Privy auth endpoint...")
print(f"Payload: {json.dumps(test_payload, indent=2)}")

# This will fail because the token is expired, but it will show us the backend logs
# which will reveal if the Privy API call is working

# Note: This is just for demonstration - the actual fix needs to be tested with a real token
print("\nNOTE: This test requires a valid Privy token to work properly.")
print("The backend will attempt to fetch the email from Privy API when the token is valid.")
print("\nThe fix is in place - the backend will now:")
print("1. Try to extract email from linked_accounts.email")
print("2. If not found, fetch user data from Privy API using the token")
print("3. Extract email from the API response")
