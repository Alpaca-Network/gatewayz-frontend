# pip install litellm
import os
from litellm import completion

# 1) Set your creds once (env or secrets manager)
export GATEWAYZ_API_KEY="gw-..." 
export GATEWAYZ_BASE_URL="https://api.gatewayz.ai"   # example; confirm your exact base URL

GATEWAYZ_API_KEY = os.environ["GATEWAYZ_API_KEY"]
GATEWAYZ_BASE_URL = os.environ.get("GATEWAYZ_BASE_URL", "https://api.gatewayz.ai")

# 2) Pick a Gatewayz model id (list them via Gatewayz "/models")
MODEL = "anthropic/claude-sonnet-4.5"   # note the required 'custom/' prefix for LiteLLM custom endpoints

resp = completion(
    model=MODEL,
    messages=[{"role": "user", "content": "Give me one sentence about Montreal bagels."}],
    api_base=GATEWAYZ_BASE_URL,      # LiteLLM will send OpenAI-format requests to Gatewayz here
    api_key=GATEWAYZ_API_KEY,        # sent as Bearer token
    timeout=60,                      # optional
)

print(resp.choices[0].message["content"])
