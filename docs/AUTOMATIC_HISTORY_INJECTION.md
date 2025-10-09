# Automatic Conversation History Injection

## Overview
✅ **Now Live!** When you provide a `session_id` in your chat requests, Gatewayz automatically fetches and injects previous conversation history before sending to the LLM.

This means you **don't need to manually send full conversation history** with each request - the backend handles it for you!

## How It Works

### Traditional Approach (Manual History)
```javascript
// ❌ OLD WAY - Client must track and send full history
const messages = [
  { role: "user", content: "What is Python?" },
  { role: "assistant", content: "Python is a programming language..." },
  { role: "user", content: "What about JavaScript?" }
];

await fetch('/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({ messages })
});
```

### New Approach (Automatic History Injection)
```javascript
// ✅ NEW WAY - Backend auto-injects history
const messages = [
  { role: "user", content: "What about JavaScript?" }
];

await fetch('/v1/chat/completions?session_id=123', {
  method: 'POST',
  body: JSON.stringify({ messages })
});
```

**What happens behind the scenes:**
1. Backend receives: `[{"role": "user", "content": "What about JavaScript?"}]`
2. Backend fetches history from session `123`
3. Backend prepends history: `[previous_msg1, previous_msg2, ..., new_msg]`
4. Backend sends combined history to LLM
5. LLM sees full context and responds appropriately

## Implementation Details

### Code Changes
Located in `src/routes/chat.py` lines 222-246:

```python
# === 2.1) Inject conversation history if session_id provided ===
if session_id:
    try:
        from src.db.chat_history import get_chat_session

        # Fetch the session with its message history
        session = await _to_thread(get_chat_session, session_id, user['id'])

        if session and session.get('messages'):
            # Transform DB messages to OpenAI format and prepend to current messages
            history_messages = [
                {"role": msg["role"], "content": msg["content"]}
                for msg in session['messages']
            ]

            # Prepend history to incoming messages
            messages = history_messages + messages

            logger.info(f"Injected {len(history_messages)} messages from session {session_id}")
```

### Security
- ✅ **User isolation:** Only fetches history for sessions owned by the authenticated user
- ✅ **Non-blocking:** If history fetch fails, request continues without history
- ✅ **Logged:** History injection events are logged for debugging

## Usage Examples

### Example 1: Basic Conversation

**Step 1: Create session**
```bash
curl -X POST 'http://localhost:8000/v1/chat/sessions' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "My Conversation",
    "model": "gpt-3.5-turbo"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "My Conversation",
    "model": "gpt-3.5-turbo"
  }
}
```

**Step 2: First message (no history yet)**
```bash
curl -X POST 'http://localhost:8000/v1/chat/completions?session_id=123' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "What is Python?"}
    ]
  }'
```

**Step 3: Follow-up message (history auto-injected!)**
```bash
curl -X POST 'http://localhost:8000/v1/chat/completions?session_id=123' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "What about JavaScript?"}
    ]
  }'
```

🎉 **The LLM automatically receives:**
```javascript
[
  { role: "user", content: "What is Python?" },
  { role: "assistant", content: "Python is a programming language..." },
  { role: "user", content: "What about JavaScript?" }
]
```

### Example 2: JavaScript/TypeScript

```typescript
class ChatService {
  private baseUrl = 'http://localhost:8000';
  private apiKey = 'YOUR_API_KEY';
  private sessionId: number | null = null;

  async createSession(title: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/chat/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, model: 'gpt-3.5-turbo' })
    });

    const data = await response.json();
    this.sessionId = data.data.id;
  }

  async sendMessage(content: string): Promise<string> {
    if (!this.sessionId) {
      await this.createSession('New Chat');
    }

    // Only send the new message - history is auto-injected!
    const response = await fetch(
      `${this.baseUrl}/v1/chat/completions?session_id=${this.sessionId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content }]
        })
      }
    );

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// Usage
const chat = new ChatService();
await chat.createSession('My Chat');

// Each call automatically includes full history
const response1 = await chat.sendMessage('What is Python?');
console.log(response1); // "Python is a programming language..."

const response2 = await chat.sendMessage('What about JavaScript?');
console.log(response2); // LLM knows we're comparing to Python!
```

### Example 3: Python

```python
import httpx

class ChatSession:
    def __init__(self, api_key: str, base_url: str = "http://localhost:8000"):
        self.api_key = api_key
        self.base_url = base_url
        self.session_id = None

    async def create_session(self, title: str):
        """Create a new chat session"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/sessions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"title": title, "model": "gpt-3.5-turbo"}
            )
            data = response.json()
            self.session_id = data["data"]["id"]

    async def send_message(self, content: str) -> str:
        """Send a message - history is auto-injected!"""
        if not self.session_id:
            await self.create_session("New Chat")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                params={"session_id": self.session_id},
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": content}]
                }
            )
            data = response.json()
            return data["choices"][0]["message"]["content"]

# Usage
chat = ChatSession(api_key="YOUR_API_KEY")
await chat.create_session("My Chat")

# Each message automatically includes full context
response1 = await chat.send_message("What is Python?")
print(response1)

response2 = await chat.send_message("What about JavaScript?")
print(response2)  # LLM knows the context!
```

### Example 4: React Component

```tsx
import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatComponent() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Create session on mount
  useEffect(() => {
    async function createSession() {
      const response = await fetch('/v1/chat/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Chat Session',
          model: 'gpt-3.5-turbo'
        })
      });
      const data = await response.json();
      setSessionId(data.data.id);
    }
    createSession();
  }, []);

  async function sendMessage() {
    if (!input.trim() || !sessionId) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Only send the new message - backend handles history!
      const response = await fetch(
        `/v1/chat/completions?session_id=${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [userMessage] // Just the new message!
          })
        }
      );

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant' as const,
        content: data.choices[0].message.content
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && sendMessage()}
        disabled={loading}
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
```

## Benefits

### 🚀 Reduced Bandwidth
- Client only sends new messages, not full history
- Significantly reduces payload size for long conversations
- Lower network costs and faster requests

### 🔒 Security
- History is validated server-side
- Cannot inject messages from other users' sessions
- All access is authenticated and logged

### 🧠 Consistent Context
- Backend ensures LLM always receives proper context
- No risk of client-side history getting out of sync
- Simplified client logic

### 📊 Better Analytics
- All messages are saved server-side
- Easy to analyze conversation patterns
- Can track context length and token usage

## Migration Guide

### Before (Manual History Management)
```javascript
// Client must track full conversation
const conversationHistory = [];

function addMessage(role, content) {
  conversationHistory.push({ role, content });
}

async function chat(message) {
  addMessage('user', message);

  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: conversationHistory // Send FULL history
    })
  });

  const data = await response.json();
  addMessage('assistant', data.choices[0].message.content);
  return data;
}
```

### After (Automatic History Injection)
```javascript
// Backend handles history automatically
let sessionId = null;

async function chat(message) {
  if (!sessionId) {
    const sessionResp = await fetch('/v1/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Chat', model: 'gpt-3.5-turbo' })
    });
    sessionId = (await sessionResp.json()).data.id;
  }

  const response = await fetch(
    `/v1/chat/completions?session_id=${sessionId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }] // Just new message!
      })
    }
  );

  return await response.json();
}
```

## Troubleshooting

### History Not Injected
**Problem:** Follow-up messages don't have context

**Solutions:**
1. Verify `session_id` query parameter is included
2. Check that session exists and belongs to your user
3. Verify messages are being saved (check `/v1/chat/sessions/{id}`)
4. Check server logs for "Injected X messages" message

### Wrong Context
**Problem:** LLM responds with wrong context

**Solutions:**
1. Verify you're using the correct `session_id`
2. Check that you haven't accidentally created multiple sessions
3. Fetch session history to verify saved messages

### Performance Issues
**Problem:** Requests slow with long conversations

**Solutions:**
1. Consider limiting history to recent N messages
2. Create new sessions for new topics
3. Monitor token usage - very long contexts increase costs

## API Reference

### Query Parameter
```
?session_id={integer}
```

- **Type:** Optional integer
- **Description:** If provided, fetches conversation history and prepends to request
- **Security:** Only fetches sessions owned by authenticated user
- **Behavior:** If session doesn't exist or fetch fails, request continues without history

### Headers in Logs
When history is injected, you'll see:
```
INFO:src.routes.chat:Injected 4 messages from session 123
```

## Testing

Test script available at `test_history_injection.py`:

```bash
python3 test_history_injection.py
```

This will:
1. Create a session
2. Send first message (no history)
3. Send follow-up message (history auto-injected)
4. Verify history was properly saved

## Compatibility

- ✅ **All providers:** Works with OpenRouter, Portkey, and Featherless
- ✅ **Streaming:** Works with both streaming and non-streaming requests
- ✅ **Models:** Compatible with all models (GPT, Claude, Llama, etc.)

## Related Documentation

- [Chat History Integration Guide](./CHAT_HISTORY_INTEGRATION.md)
- [API Documentation](http://localhost:8000/docs)
- Implementation: `src/routes/chat.py` (lines 222-246)
