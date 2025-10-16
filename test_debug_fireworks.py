#!/usr/bin/env python
"""Debug the exact Fireworks error"""

import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up detailed logging
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

from src.services.fireworks_client import make_fireworks_request_openai
from dotenv import load_dotenv

load_dotenv()

def test_fireworks():
    """Test the exact same call that the API makes"""

    model = "accounts/fireworks/models/deepseek-v3p1"
    messages = [{"role": "user", "content": "Hello! What can you help me with?"}]

    print(f"Testing model: {model}")
    print("-" * 50)

    try:
        # This is exactly what the chat.py endpoint calls
        response = make_fireworks_request_openai(messages, model)
        print(f"SUCCESS! Response: {response}")
    except Exception as e:
        print(f"ERROR: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_fireworks()