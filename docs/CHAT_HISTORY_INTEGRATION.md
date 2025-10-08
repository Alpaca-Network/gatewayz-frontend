# Chat History Integration Guide

## Overview
The chat history feature allows you to save and retrieve chat conversations. It requires a two-step process:
1. Create a chat session
2. Use the session_id when making chat completion requests

## API Endpoints

### 1. Create a Chat Session
```http
POST /v1/chat/sessions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "title": "My Chat Session",  // optional, auto-generated if not provided
  "model": "openai/gpt-3.5-turbo"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "user_id": 456,
    "title": "My Chat Session",
    "model": "openai/gpt-3.5-turbo",
    "created_at": "2025-01-08T12:00:00Z",
    "updated_at": "2025-01-08T12:00:00Z",
    "is_active": true
  },
  "message": "Chat session created successfully"
}
```

### 2. Use Session in Chat Completions
```http
POST /v1/chat/completions?session_id=123
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "openai/gpt-3.5-turbo",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

**What happens automatically:**
- User message is saved to the session
- Assistant response is saved to the session
- Token usage is tracked

### 3. Get All Sessions
```http
GET /v1/chat/sessions?limit=50&offset=0
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "My Chat Session",
      "model": "openai/gpt-3.5-turbo",
      "created_at": "2025-01-08T12:00:00Z",
      "updated_at": "2025-01-08T12:00:00Z"
    }
  ],
  "count": 1,
  "message": "Retrieved 1 chat sessions"
}
```

### 4. Get Session with Messages
```http
GET /v1/chat/sessions/123
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "My Chat Session",
    "model": "openai/gpt-3.5-turbo",
    "messages": [
      {
        "id": 1,
        "role": "user",
        "content": "Hello",
        "tokens": 0,
        "created_at": "2025-01-08T12:00:00Z"
      },
      {
        "id": 2,
        "role": "assistant",
        "content": "Hi! How can I help you?",
        "tokens": 150,
        "created_at": "2025-01-08T12:00:05Z"
      }
    ]
  },
  "message": "Chat session retrieved successfully"
}
```

### 5. Update Session
```http
PUT /v1/chat/sessions/123
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "title": "Updated Title",
  "model": "openai/gpt-4"
}
```

### 6. Delete Session
```http
DELETE /v1/chat/sessions/123
Authorization: Bearer {api_key}
```

### 7. Search Sessions
```http
POST /v1/chat/search
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "query": "search term",
  "limit": 20
}
```

### 8. Get Statistics
```http
GET /v1/chat/stats
Authorization: Bearer {api_key}
```

## Frontend Integration Examples

### React/TypeScript Example

```typescript
// types.ts
export interface ChatSession {
  id: number;
  user_id: number;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens: number;
  created_at: string;
}

// chatHistoryService.ts
const API_BASE = 'https://api.gatewayz.ai';

export class ChatHistoryService {
  constructor(private apiKey: string) {}

  async createSession(title?: string, model?: string): Promise<ChatSession> {
    const response = await fetch(`${API_BASE}/v1/chat/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, model }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }

  async getSessions(limit = 50, offset = 0): Promise<ChatSession[]> {
    const response = await fetch(
      `${API_BASE}/v1/chat/sessions?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }

  async getSession(sessionId: number): Promise<ChatSession> {
    const response = await fetch(`${API_BASE}/v1/chat/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }

  async deleteSession(sessionId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/v1/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  }

  async updateSession(
    sessionId: number,
    updates: { title?: string; model?: string }
  ): Promise<ChatSession> {
    const response = await fetch(`${API_BASE}/v1/chat/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }

  // Modified chat completion with session support
  async sendMessage(
    messages: Array<{role: string; content: string}>,
    model: string,
    sessionId?: number,
    stream = false
  ): Promise<any> {
    const url = sessionId
      ? `${API_BASE}/v1/chat/completions?session_id=${sessionId}`
      : `${API_BASE}/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    });

    if (stream) {
      return response.body; // Return stream for processing
    }

    return await response.json();
  }
}

// Usage in a React component
import { useState, useEffect } from 'react';

export function ChatComponent({ apiKey }: { apiKey: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const chatService = new ChatHistoryService(apiKey);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const sessions = await chatService.getSessions();
    setSessions(sessions);
  }

  async function createNewSession() {
    const session = await chatService.createSession();
    setCurrentSession(session);
    setMessages([]);
    setSessions([session, ...sessions]);
  }

  async function loadSession(sessionId: number) {
    const session = await chatService.getSession(sessionId);
    setCurrentSession(session);
    setMessages(session.messages || []);
  }

  async function sendMessage() {
    if (!input.trim()) return;

    // Optimistically add user message
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage as any]);
    setInput('');

    try {
      // Send to API with session_id
      const response = await chatService.sendMessage(
        [...messages, userMessage],
        'openai/gpt-3.5-turbo',
        currentSession?.id
      );

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: response.choices[0].message.content,
      };
      setMessages([...messages, userMessage as any, assistantMessage as any]);

      // Reload session to get updated messages with IDs
      if (currentSession) {
        await loadSession(currentSession.id);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  return (
    <div className="chat-container">
      {/* Session list sidebar */}
      <div className="sessions-sidebar">
        <button onClick={createNewSession}>New Chat</button>
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => loadSession(session.id)}
            className={currentSession?.id === session.id ? 'active' : ''}
          >
            {session.title}
          </div>
        ))}
      </div>

      {/* Chat messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

### Next.js Example

```typescript
// app/api/chat/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');

  const response = await fetch('https://api.gatewayz.ai/v1/chat/sessions', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  return NextResponse.json(await response.json());
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  const body = await request.json();

  const response = await fetch('https://api.gatewayz.ai/v1/chat/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await response.json());
}

// app/api/chat/sessions/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');

  const response = await fetch(
    `https://api.gatewayz.ai/v1/chat/sessions/${params.id}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  return NextResponse.json(await response.json());
}
```

### Vanilla JavaScript Example

```javascript
class ChatHistory {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.gatewayz.ai';
  }

  async createSession(title, model) {
    const response = await fetch(`${this.baseUrl}/v1/chat/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, model }),
    });
    return await response.json();
  }

  async getSessions() {
    const response = await fetch(`${this.baseUrl}/v1/chat/sessions`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
    return await response.json();
  }

  async sendMessage(messages, model, sessionId) {
    const url = sessionId
      ? `${this.baseUrl}/v1/chat/completions?session_id=${sessionId}`
      : `${this.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    });
    return await response.json();
  }
}

// Usage
const chat = new ChatHistory('your_api_key');

// Create session
const session = await chat.createSession('My Chat');
console.log('Created session:', session.data.id);

// Send message
const response = await chat.sendMessage(
  [{ role: 'user', content: 'Hello' }],
  'openai/gpt-3.5-turbo',
  session.data.id
);
console.log('Response:', response);
```

## Best Practices

1. **Create session on new chat** - Always create a session before starting a new conversation
2. **Reuse sessions** - Use the same session_id for follow-up messages in a conversation
3. **Handle errors gracefully** - Session might not exist, handle 404 errors
4. **Update titles** - Let users rename their chat sessions for better organization
5. **Pagination** - Use limit/offset for large session lists
6. **Cleanup** - Delete old sessions when no longer needed

## Testing

```bash
# Test creating a session
curl -X POST "https://api.gatewayz.ai/v1/chat/sessions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Chat"}'

# Test chat with session (use the ID from above)
curl -X POST "https://api.gatewayz.ai/v1/chat/completions?session_id=123" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Verify messages were saved
curl "https://api.gatewayz.ai/v1/chat/sessions/123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Common Issues

### Issue: Messages not being saved
**Solution:** Make sure you're passing `?session_id=X` as a query parameter

### Issue: Session not found (404)
**Solution:** Verify the session belongs to the authenticated user

### Issue: Empty messages array
**Solution:** Ensure you've made at least one chat completion request with the session_id

## Support

For issues or questions, check:
- API Documentation: https://api.gatewayz.ai/docs
- Tests: `tests/db/test_chat_history.py`
- Implementation: `src/routes/chat_history.py`
