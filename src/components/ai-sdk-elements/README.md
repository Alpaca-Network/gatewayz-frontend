# AI SDK Elements

Custom implementation of Vercel AI SDK Elements design patterns for building consistent, composable chat interfaces.

## Overview

AI SDK Elements provides a set of primitive components that follow the official [Vercel AI SDK Elements](https://ai-sdk.dev/elements) design patterns. These components are designed to work seamlessly with the AI SDK's `useChat` hook.

## Components

### Message Components

#### `<Message>`
Container for a single message with role-based layout.

```tsx
<Message role="user">
  {/* Message content */}
</Message>
```

Props:
- `role`: `'user' | 'assistant' | 'system'`
- `className`: Optional styling
- Standard div props

---

#### `<MessageContent>`
Displays message content with optional Markdown rendering.

```tsx
<MessageContent role="assistant" markdown>
  Hello! How can I **help** you today?
</MessageContent>
```

Props:
- `role`: `'user' | 'assistant' | 'system'`
- `markdown`: `boolean` (default: `true`) - Enable Markdown rendering
- `className`: Optional styling
- Standard div props

Features:
- GitHub Flavored Markdown (GFM)
- Math equations (KaTeX)
- Syntax highlighting for code blocks
- Automatic link handling
- Role-based styling

---

#### `<MessageList>`
Container for message thread with proper spacing.

```tsx
<MessageList>
  <Message role="user">...</Message>
  <Message role="assistant">...</Message>
</MessageList>
```

Props:
- `className`: Optional styling
- Standard div props

---

#### `<MessageAvatar>`
User or assistant avatar with role-based styling.

```tsx
<MessageAvatar role="user">
  {/* Optional: Custom avatar content */}
</MessageAvatar>
```

Props:
- `role`: `'user' | 'assistant' | 'system'`
- `className`: Optional styling
- `children`: Optional custom content (defaults to role initial)
- Standard div props

---

#### `<MessageMetadata>`
Displays message metadata (timestamp, tokens, etc.).

```tsx
<MessageMetadata>
  <span>2:30 PM</span>
  <span>•</span>
  <span>150 tokens</span>
</MessageMetadata>
```

Props:
- `className`: Optional styling
- Standard div props

---

### Prompt Components

#### `<PromptForm>`
Form container for prompt input.

```tsx
<PromptForm onSubmit={handleSubmit}>
  {/* Prompt components */}
</PromptForm>
```

Props:
- `onSubmit`: Form submit handler
- `className`: Optional styling
- Standard form props

---

#### `<PromptInput>`
Textarea for user input with Enter-to-submit.

```tsx
<PromptInput
  value={input}
  onChange={handleInputChange}
  onSubmit={handleSubmit}
  disabled={isLoading}
/>
```

Props:
- `value`: Input value
- `onChange`: Change handler
- `onSubmit`: Optional submit handler (triggered by Enter key)
- `disabled`: Disable input
- `className`: Optional styling
- Standard textarea props

Features:
- Auto-resizing textarea
- Enter to submit (Shift+Enter for new line)
- Disabled state during loading

---

#### `<PromptSubmit>`
Submit button with loading state and stop capability.

```tsx
<PromptSubmit
  isLoading={isLoading}
  onStop={stop}
  disabled={!input.trim()}
/>
```

Props:
- `isLoading`: Show stop button instead of submit
- `onStop`: Handler for stopping generation
- `disabled`: Disable button
- `children`: Optional custom content (defaults to Send/Stop icon)
- `className`: Optional styling
- Standard button props

---

#### `<PromptContainer>`
Layout container for prompt input and actions.

```tsx
<PromptContainer>
  <PromptInput />
  <PromptActions>
    <PromptSubmit />
  </PromptActions>
</PromptContainer>
```

Props:
- `className`: Optional styling
- Standard div props

---

#### `<PromptActions>`
Container for prompt action buttons.

```tsx
<PromptActions>
  <PromptSubmit />
  <Button>Clear</Button>
</PromptActions>
```

Props:
- `className`: Optional styling
- Standard div props

---

#### `<PromptLoading>`
Loading indicator for streaming responses.

```tsx
<PromptLoading text="Thinking..." />
```

Props:
- `text`: Loading text (default: "Thinking...")
- `className`: Optional styling
- Standard div props

---

## Complete Example

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import {
  Message,
  MessageContent,
  MessageList,
  MessageAvatar,
  MessageMetadata,
  PromptForm,
  PromptInput,
  PromptSubmit,
  PromptContainer,
  PromptActions,
  PromptLoading,
} from '@/components/ai-sdk-elements';

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat/ai-sdk-completions',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        <MessageList>
          {messages.map((message) => (
            <Message key={message.id} role={message.role}>
              <MessageAvatar role={message.role} />
              <div>
                <MessageContent role={message.role} markdown>
                  {message.content}
                </MessageContent>
                <MessageMetadata>
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                </MessageMetadata>
              </div>
            </Message>
          ))}
          {isLoading && <PromptLoading />}
        </MessageList>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <PromptForm onSubmit={handleSubmit}>
          <PromptContainer>
            <PromptInput
              value={input}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <PromptActions>
              <PromptSubmit isLoading={isLoading} disabled={!input.trim()} />
            </PromptActions>
          </PromptContainer>
        </PromptForm>
      </div>
    </div>
  );
}
```

## Styling

All components accept a `className` prop for custom styling. They use Tailwind CSS by default and integrate with the shadcn/ui design system.

### Customization Example

```tsx
// Custom message styling
<MessageContent
  role="assistant"
  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
>
  Custom styled message
</MessageContent>

// Custom prompt styling
<PromptInput
  className="border-2 border-primary rounded-full"
  placeholder="Ask me anything..."
/>
```

## Integration with AI SDK

These components are designed to work with AI SDK hooks:

```tsx
import { useChat } from '@ai-sdk/react';
import { Message, MessageContent, PromptForm, PromptInput } from '@/components/ai-sdk-elements';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
});

// Components automatically handle messages array from useChat
{messages.map(m => (
  <Message key={m.id} role={m.role}>
    <MessageContent role={m.role}>{m.content}</MessageContent>
  </Message>
))}
```

## Design Principles

1. **Composable**: Small, focused components that can be combined
2. **Accessible**: Semantic HTML with proper ARIA attributes
3. **Customizable**: Full control over styling with className
4. **Type-Safe**: Full TypeScript support with proper types
5. **Consistent**: Follows AI SDK Elements design patterns
6. **Performant**: Optimized rendering with React best practices

## Related Components

- **ReasoningDisplay**: Shows chain-of-thought reasoning (`src/components/chat/reasoning-display.tsx`)
- **AISDKChatElements**: Complete chat interface using Elements (`src/components/chat/ai-sdk-chat-elements.tsx`)

## Resources

- [Vercel AI SDK Elements](https://ai-sdk.dev/elements)
- [AI SDK React Hooks](https://ai-sdk.dev/docs/ai-sdk-ui/overview)
- [shadcn/ui Components](https://ui.shadcn.com)
