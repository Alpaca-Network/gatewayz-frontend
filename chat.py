import requests
import json

API_URL = "https://api.gatewayz.ai/v1/chat/completions"
API_KEY = "gw_temp_lw1xmCuEfLkKn6tsaDF3vw"  # ⚠️ Don't share this publicly!

def chat(prompt):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    data = {
        "model": "anthropic/claude-sonnet-4",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post(API_URL, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        res_json = response.json()
        message = res_json["choices"][0]["message"]["content"]
        print(f"\n🧠 AI: {message}\n")
    else:
        print(f"❌ Error {response.status_code}: {response.text}")

def main():
    print("=== Gatewayz AI Terminal Chat ===")
    print("Type 'exit' to quit.\n")

    while True:
        user_input = input("💬 You: ")
        if user_input.lower() in ["exit", "quit"]:
            print("👋 Goodbye!")
            break
        chat(user_input)

if __name__ == "__main__":
    main()