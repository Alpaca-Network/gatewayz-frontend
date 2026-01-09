# AI SDK Integration Guide

This document explains how Vercel AI SDK is integrated into Gatewayz as an additional gateway alongside the existing multi-gateway architecture.

## Architecture Overview

### Design Pattern
The AI SDK integration follows a **gateway adapter pattern**:
- **No replacement** of existing infrastructure
- **Complementary addition** to existing gateways
- **Backward compatible** with all current features
- **Opt-in** selection for users

### Components

#### 1. **Core Gateway Wrapper** (`src/lib/ai-sdk-gateway.ts`)
Provides the foundational integration layer:

```typescript
// Check if model supports thinking/reasoning
modelSupportsThinking(modelId: string): boolean

// Convert between Gatewayz and AI SDK formats
convertToAISDKMessage(msg: any): AISDKMessage
convertFromAISDKResponse(response: any): { content: string; reasoning?: string }

// Parse streaming responses with thinking support
parseAISDKStream(stream: ReadableStream): AsyncGenerator<AISDKStreamChunk>

// Make API calls to AI SDK backend
callAISDKCompletion(messages, modelId, options): Promise<ReadableStream>
```

#### 2. **Chat Service** (`src/lib/ai-sdk-chat-service.ts`)
Bridges existing chat system with AI SDK:

```typescript
// Stream messages through AI SDK
streamAISDKChat(options: AISDKChatOptions): AsyncGenerator

// Check if model available via AI SDK
isAISDKModel(modelId: string): boolean

// Get available AI SDK models
getAISDKAvailableModels(): Model[]
```

#### 3. **React Hook** (`src/hooks/useAISDKChat.ts`)
Provides component-level integration:

```typescript
const {
  messages,
  isLoading,
  currentContent,
  currentReasoning,
  error,
  sendMessage,
  cancelMessage,
  clearMessages,
} = useAISDKChat({
  model: 'claude-3-5-sonnet',
  enableThinking: true,
  temperature: 0.7,
  maxTokens: 4096,
})
```

#### 4. **API Endpoint** (`src/app/api/chat/ai-sdk/route.ts`)
Server-side endpoint for streaming chat:

```
POST /api/chat/ai-sdk
Content-Type: application/json

{
  "messages": [{ "role": "user", "content": "..." }],
  "model": "claude-3-5-sonnet",
  "enable_thinking": true,
  "temperature": 0.7,
  "max_tokens": 4096
}
```

#### 5. **Enhanced UI Components**
- `ReasoningDisplay` - Updated to support structured reasoning steps
- `AISDKModelOption` - Component for displaying AI SDK models in selector

## Chain-of-Thought Reasoning

### How It Works

1. **Model Detection**: When a user selects an AI SDK model that supports thinking
2. **Request**: Messages are sent with `enable_thinking: true`
3. **Streaming**: Responses stream in real-time with separate content and reasoning
4. **Display**: `ReasoningDisplay` component shows thinking process

### Supported Models

Models with native thinking/reasoning support:

- **Claude 3.5 Sonnet** (`claude-3-5-sonnet`) - Extended thinking
- **Claude Opus 4** (`claude-opus-4`) - Extended thinking
- **GPT-4o** (`gpt-4o`) - Content only
- **GPT-4 Turbo** (`gpt-4-turbo`) - Content only
- **DeepSeek Reasoner** (`deepseek-reasoner`) - Chain-of-thought
- **Qwen Plus** (`qwen-plus`) - Reasoning support

### Message Format

```typescript
interface AISDKMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string; // Thinking/chain-of-thought content
}
```

### UI Display

The `ReasoningDisplay` component now supports two modes:

1. **Plain Text** (Gatewayz gateway reasoning)
   ```tsx
   <ReasoningDisplay
     reasoning={reasoningText}
     source="gatewayz"
   />
   ```

2. **Structured Steps** (AI SDK thinking)
   ```tsx
   <ReasoningDisplay
     reasoning={fullReason}
     steps={[
       { id: '1', title: 'Understanding', content: '...', status: 'completed' },
       { id: '2', title: 'Analysis', content: '...', status: 'in_progress' },
     ]}
     source="ai-sdk"
   />
   ```

## Integration Points

### In Chat Page

The existing chat page should be updated to:

1. **Detect AI SDK models**:
   ```typescript
   if (isAISDKModel(selectedModel.value)) {
     // Use AI SDK streaming
     yield* streamAISDKChat({ ... })
   } else {
     // Use existing streaming
     yield* streamChatResponse({ ... })
   }
   ```

2. **Handle thinking responses**:
   ```typescript
   // Both gateways populate reasoning field
   assistantMessage.reasoning = chunk.reasoning

   // UI displays it automatically via ReasoningDisplay
   <ReasoningDisplay reasoning={message.reasoning} />
   ```

### Model Selector Integration

Add AI SDK models as an option category:

1. Fetch AI SDK available models alongside gateway models
2. Display with "AI SDK" badge
3. Show thinking capability indicator
4. Maintain existing sorting/filtering logic

### Session Management

AI SDK messages are saved to chat history in same format:

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string; // Works for both Gatewayz and AI SDK
  model?: string;
  isStreaming?: boolean;
}
```

No database schema changes needed.

## Environment Configuration

Add these environment variables to `.env`:

```bash
# AI SDK Configuration
AI_SDK_API_KEY=your-api-key-here
AI_SDK_BASE_URL=https://api.anthropic.com/v1  # or other provider

# Existing Gatewayz variables (unchanged)
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
NEXT_PUBLIC_PRIVY_APP_ID=...
```

## Usage Examples

### Basic Chat with AI SDK

```typescript
import { useAISDKChat } from '@/hooks/useAISDKChat'

export function MyComponent() {
  const { messages, sendMessage, isLoading } = useAISDKChat({
    model: 'claude-3-5-sonnet',
    enableThinking: true,
  })

  return (
    <>
      <div>
        {messages.map((msg) => (
          <div key={msg.role}>
            {msg.reasoning && <ReasoningDisplay reasoning={msg.reasoning} />}
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      <input
        onSubmit={(e) => sendMessage(e.target.value)}
        disabled={isLoading}
      />
    </>
  )
}
```

### Streaming with Real-time Reasoning

```typescript
import { streamAISDKChat } from '@/lib/ai-sdk-chat-service'

async function* streamResponse(message: string) {
  const stream = streamAISDKChat({
    model: 'claude-3-5-sonnet',
    messages: [{ role: 'user', content: message }],
    enableThinking: true,
    apiKey: userApiKey,
  })

  for await (const chunk of stream) {
    if (chunk.reasoning) {
      updateReasoningDisplay(chunk.reasoning)
    }
    if (chunk.content) {
      updateContentDisplay(chunk.content)
    }
  }
}
```

### Mixed Gateway Usage

```typescript
function sendMessage(userMessage: string) {
  const isAISDKModel = isAISDKModel(selectedModel.value)

  if (isAISDKModel) {
    // Route to AI SDK endpoint
    const stream = streamAISDKChat({
      model: selectedModel.value,
      messages: [...messages, { role: 'user', content: userMessage }],
      enableThinking: true,
      apiKey,
    })
  } else {
    // Use existing Gatewayz streaming
    const stream = streamChatResponse(url, apiKey, {
      model: selectedModel.value,
      messages: [...messages, { role: 'user', content: userMessage }],
    })
  }
}
```

## Testing

### Test Chain-of-Thought Functionality

1. **Enable a model with thinking support**:
   - Select Claude 3.5 Sonnet or similar
   - Verify "Thinking" badge appears

2. **Send a reasoning-intensive prompt**:
   ```
   "Break down how photosynthesis works step by step,
    explaining the light reactions and dark reactions separately."
   ```

3. **Verify reasoning display**:
   - Reasoning section expands automatically during streaming
   - Content and reasoning stream in real-time
   - Completed toggle shows proper state

4. **Test without thinking**:
   - Select model without thinking capability
   - Send same prompt
   - Verify no reasoning section appears

## Backward Compatibility

- **Existing gateways**: Fully functional unchanged
- **Chat history**: No schema changes required
- **Message format**: Extended with optional `reasoning` field
- **UI components**: Updated to handle both formats gracefully
- **APIs**: New endpoint added, existing endpoints untouched

## Performance Considerations

1. **Streaming**: Real-time reasoning display for better UX
2. **Caching**: AI SDK model list cached 5 minutes
3. **Lazy loading**: Components load on demand
4. **Error handling**: Graceful fallback to content-only display

## Security Notes

- AI SDK API keys stored in server environment only
- Frontend never directly accesses AI SDK credentials
- All requests proxied through `/api/chat/ai-sdk` endpoint
- Bearer token authentication for API calls

## Future Enhancements

1. **Tool Integration**: Add tool use support to AI SDK models
2. **Vision Support**: Implement image understanding for multimodal models
3. **Function Calling**: Support structured outputs and function calls
4. **Cost Tracking**: Monitor AI SDK API usage and costs
5. **Model Switching**: Seamless switching between gateways mid-conversation
6. **Structured Thinking**: Parse thinking steps into visually distinct blocks
