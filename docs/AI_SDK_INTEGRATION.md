# AI SDK Integration Guide

## Overview

Gatewayz Beta now integrates the official **Vercel AI SDK** for streaming chat completions with chain-of-thought reasoning support. This provides a modern, production-ready foundation for AI-powered chat interfaces.

## What's Included

### 1. AI SDK Packages

- **`ai`** (v5.0.105) - Core AI SDK with `streamText`, `generateText`, and utilities
- **`@ai-sdk/react`** (v2.0.81) - React hooks (`useChat`, `useCompletion`)
- **`@ai-sdk/openai`** (v2.0.75) - OpenAI provider (GPT models)
- **`@ai-sdk/anthropic`** (v2.0.52) - Anthropic provider (Claude models with Extended Thinking)
- **`@ai-sdk/google`** (v2.0.44) - Google provider (Gemini models)

### 2. API Routes

#### `/api/chat/ai-sdk-completions`
New streaming endpoint using AI SDK's `streamText`:

**Location**: `src/app/api/chat/ai-sdk-completions/route.ts`

**Features**:
- Multi-provider support (OpenAI, Anthropic, Google, OpenRouter)
- Automatic provider detection based on model ID
- Chain-of-thought reasoning for supported models
- Streaming responses with proper error handling
- Performance metrics and logging

**Request Example**:
```typescript
POST /api/chat/ai-sdk-completions
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "claude-3-7-sonnet-20250219",
  "messages": [
    { "role": "user", "content": "Explain quantum computing" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "apiKey": "gw_..." // Optional, can use Authorization header
}
```

### 3. React Hooks

#### `useChat` from `@ai-sdk/react`
Official AI SDK hook for chat interfaces:

**Features**:
- Automatic message history management
- Streaming responses with real-time updates
- Optimistic UI updates
- Error handling and retry
- Stop generation capability
- Built-in loading states

**Usage Example**:
```tsx
import { useChat } from '@ai-sdk/react';

function ChatComponent() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
  } = useChat({
    api: '/api/chat/ai-sdk-completions',
    body: {
      model: 'claude-3-7-sonnet-20250219',
      apiKey: 'gw_...',
    },
    onFinish: (message) => {
      console.log('Message finished:', message);
    },
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### 4. AI SDK Elements

Custom implementation of AI SDK Elements design patterns.

**Location**: `src/components/ai-sdk-elements/`

#### Message Components

```tsx
import {
  Message,
  MessageContent,
  MessageList,
  MessageAvatar,
  MessageMetadata,
} from '@/components/ai-sdk-elements';

<MessageList>
  <Message role="user">
    <MessageAvatar role="user" />
    <MessageContent role="user">
      Hello, AI!
    </MessageContent>
  </Message>
  <Message role="assistant">
    <MessageAvatar role="assistant" />
    <MessageContent role="assistant" markdown>
      Hello! How can I help you today?
    </MessageContent>
    <MessageMetadata>
      <span>2:30 PM</span>
    </MessageMetadata>
  </Message>
</MessageList>
```

#### Prompt Components

```tsx
import {
  PromptForm,
  PromptInput,
  PromptSubmit,
  PromptContainer,
  PromptActions,
  PromptLoading,
} from '@/components/ai-sdk-elements';

<PromptForm onSubmit={handleSubmit}>
  <PromptContainer>
    <PromptInput
      value={input}
      onChange={handleInputChange}
      disabled={isLoading}
    />
    <PromptActions>
      <PromptSubmit isLoading={isLoading} onStop={stop} />
    </PromptActions>
  </PromptContainer>
  {isLoading && <PromptLoading />}
</PromptForm>
```

### 5. Pre-built Chat Components

#### AISDKChatElements

Complete chat interface using AI SDK with Elements UI.

**Location**: `src/components/chat/ai-sdk-chat-elements.tsx`

**Features**:
- Streaming chat with AI SDK's `useChat`
- Chain-of-thought reasoning display
- Markdown rendering with syntax highlighting
- Message avatars and metadata
- Error handling with retry
- Stop generation capability
- Fully customizable styling

**Usage**:
```tsx
import { AISDKChatElements } from '@/components/chat/ai-sdk-chat-elements';

<AISDKChatElements
  modelId="claude-3-7-sonnet-20250219"
  apiKey="gw_..."
  initialMessages={[
    { id: '1', role: 'user', content: 'Hello!' }
  ]}
  onError={(error) => console.error(error)}
  onFinish={(message) => console.log(message)}
/>
```

## Chain-of-Thought Reasoning

### Supported Models

Models with native extended thinking support:
- **Claude 3.7 Sonnet** (`claude-3-7-sonnet-20250219`)
- **Claude Opus 4** (`claude-opus-4-20250514`)
- **GPT-4o** with reasoning tokens (coming soon)
- **OpenAI o1** series models

### Reasoning Display

The `ReasoningDisplay` component shows the model's thinking process:

**Location**: `src/components/chat/reasoning-display.tsx`

**Features**:
- Collapsible reasoning blocks
- Real-time streaming of thoughts
- Visual differentiation from regular content
- Source badges (AI SDK vs Gateway)
- Structured step display

**Usage**:
```tsx
import { ReasoningDisplay } from '@/components/chat/reasoning-display';

<ReasoningDisplay
  reasoning={message.experimental_thinking}
  isStreaming={isLoading}
  source="ai-sdk"
/>
```

## Demo Page

Visit `/ai-sdk-demo` to test the AI SDK integration with:
- Multiple model selection
- Live streaming chat
- Chain-of-thought reasoning visualization
- Error handling demonstration
- Performance monitoring

## Migration Guide

### From Custom Streaming to AI SDK

**Before** (Custom Implementation):
```tsx
const { streamMessage, isStreaming } = useChatStream();

await streamMessage({
  sessionId,
  content: userMessage,
  model: selectedModel,
  messagesHistory,
});
```

**After** (AI SDK):
```tsx
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat/ai-sdk-completions',
  body: { model: modelId, apiKey },
});

// Automatically handles streaming, history, and UI updates
<form onSubmit={handleSubmit}>
  <input value={input} onChange={handleInputChange} />
</form>
```

### Benefits of Migration

✅ **Less Code**: AI SDK handles message management, streaming, and UI updates automatically

✅ **Better Performance**: Optimized streaming with built-in chunking and batching

✅ **Type Safety**: Full TypeScript support with proper types

✅ **Error Handling**: Built-in error states and retry mechanisms

✅ **Reasoning Support**: Native chain-of-thought with `experimental_thinking`

✅ **Provider Flexibility**: Easy to switch between OpenAI, Anthropic, Google, etc.

✅ **Maintenance**: Official SDK maintained by Vercel with regular updates

## Provider Configuration

### Environment Variables

Add to `.env.local`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_API_KEY=...

# Gatewayz (for OpenRouter and multi-gateway)
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

### Custom Providers

To add a new provider:

1. Install the provider SDK:
   ```bash
   pnpm add @ai-sdk/[provider-name]
   ```

2. Update `src/app/api/chat/ai-sdk-completions/route.ts`:
   ```typescript
   import { createProvider } from '@ai-sdk/provider-name';

   const provider = createProvider({
     apiKey: process.env.PROVIDER_API_KEY,
   });

   // Add to getProviderAndModel function
   if (modelId.includes('provider-keyword')) {
     return {
       provider: 'provider-name',
       model: provider(modelId),
     };
   }
   ```

## Advanced Features

### Custom Streaming Transformations

```typescript
import { streamText } from 'ai';

const result = streamText({
  model,
  messages,
  onChunk: ({ chunk }) => {
    // Process each chunk
    console.log('Chunk:', chunk);
  },
  onFinish: ({ text, usage }) => {
    // Log completion
    console.log('Finished:', { text, usage });
  },
});
```

### Thinking Budget Control

For models with extended thinking:

```typescript
const result = streamText({
  model,
  messages,
  experimental_thinking: {
    enabled: true,
    budgetTokens: 10000, // Max tokens for reasoning
  },
});
```

### Multi-modal Support

```typescript
const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What's in this image?' },
      { type: 'image', image: 'https://...' },
    ],
  },
];
```

## Best Practices

1. **Use AI SDK for New Features**: Start with `useChat` for all new chat interfaces
2. **Enable Thinking for Complex Tasks**: Use models with extended thinking for reasoning-heavy tasks
3. **Handle Errors Gracefully**: Always provide error UI and retry options
4. **Monitor Performance**: Log completion times and token usage
5. **Type Everything**: Use TypeScript for type safety
6. **Test Streaming**: Verify streaming works in production environments
7. **Secure API Keys**: Never expose provider API keys to the client

## Troubleshooting

### Streaming Not Working

- Check CORS configuration
- Verify API route is returning `Response` with proper headers
- Ensure `stream: true` in request body

### Reasoning Not Displaying

- Verify model supports extended thinking
- Check `experimental_thinking` is enabled in request
- Look for `experimental_thinking` field in message object

### Provider Errors

- Verify API keys are set in environment variables
- Check provider SDK is installed
- Review provider-specific rate limits and quotas

## Resources

- [Vercel AI SDK Docs](https://ai-sdk.dev)
- [AI SDK Elements](https://ai-sdk.dev/elements)
- [Streaming Guide](https://ai-sdk.dev/docs/foundations/streaming)
- [Chain-of-Thought](https://ai-sdk.dev/docs/ai-sdk-ui/chain-of-thought)

## Support

For issues or questions:
- Check logs in browser console and server logs
- Review error messages in the UI
- Test with the `/ai-sdk-demo` page first
- Consult the Vercel AI SDK documentation
