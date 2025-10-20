# Reasoning Display Feature

## Overview

The chat interface now supports displaying thinking/reasoning from AI models that output their thought process. This appears as an expandable amber-colored section above the main response.

## Supported Response Formats

The streaming parser automatically detects and displays reasoning from multiple formats:

### 1. API Response Fields (Structured)

**Output Format:**
```json
{
  "output": [{
    "content": "The answer is...",
    "reasoning": "Let me think about this...",
    "thinking": "First, I need to...",
    "analysis": "Analyzing the problem..."
  }]
}
```

**OpenAI/Choices Format:**
```json
{
  "choices": [{
    "delta": {
      "content": "The answer is...",
      "reasoning": "Let me think about this...",
      "thinking": "First, I need to...",
      "analysis": "Analyzing...",
      "inner_thought": "Hmm...",
      "thoughts": "I should..."
    }
  }]
}
```

### 2. Inline Thinking Tags

Models can also embed thinking in the content using XML-style tags:

```
<thinking>
Let me analyze this problem step by step...
1. First consideration...
2. Second point...
</thinking>

The answer is 42.
```

Supported tag formats:
- `<thinking>...</thinking>`
- `<think>...</think>`
- `[THINKING]...[/THINKING]`
- `<|startofthinking|>...<|endofthinking|>`

## UI Features

### Collapsible Display
- Reasoning appears in an amber-colored expandable section
- Automatically expanded when streaming
- Can be collapsed/expanded by clicking the header
- Shows "Thinking..." during streaming
- Shows "Show/Hide reasoning" when complete

### Visual Indicators
- Brain icon (🧠) in the header
- Pulsing cursor during streaming
- Amber theme to distinguish from main content

## How to Test

### Models with Reasoning Support

To test the reasoning display, use models that explicitly output thinking:

1. **DeepSeek R1** - Explicit reasoning model
2. **GPT-4 with reasoning** - When configured to show thinking
3. **Claude with extended thinking** - When enabled
4. **Custom models** - That output reasoning in supported formats

### Testing with Arch-Router

The default Arch-Router model may not output explicit reasoning. To test:

```bash
# Try a model known to support reasoning
# Check the console for logs:
[REASONING] Received explicit reasoning chunk: ...
[Streaming] Found reasoning field in output: ...
[ReasoningDisplay] Rendering reasoning: ...
```

## Debugging

### Console Logs

When reasoning is detected, you'll see:

```
[Streaming] Found reasoning field in output: {hasReasoning: true, ...}
[Streaming] Adding reasoning to chunk: 123 chars
[REASONING] Received explicit reasoning chunk: 123 chars
[REASONING] Updated message with reasoning: {reasoningLength: 123, ...}
[ReasoningDisplay] Rendering reasoning: {length: 123, isStreaming: true, ...}
```

### Common Issues

**Reasoning not showing up:**
1. Check console for reasoning logs
2. Verify the model supports reasoning output
3. Check if reasoning field is empty/whitespace
4. Verify the API response format matches supported schemas

**Reasoning collapsed:**
- Click the amber header to expand
- During streaming, it should auto-expand

## Implementation Details

### Files Modified
- `src/components/chat/reasoning-display.tsx` - Display component
- `src/lib/streaming.ts` - Stream parsing and reasoning extraction
- `src/app/chat/page.tsx` - Integration and state management

### Key Functions
- `toPlainText()` - Extracts text from various data structures
- `streamChatResponse()` - Parses streaming responses
- `ReasoningDisplay` - UI component

### State Management
- Reasoning accumulated in `accumulatedReasoning` variable
- Stored in message.reasoning field
- Rendered conditionally based on content presence
