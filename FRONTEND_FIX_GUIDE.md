# Frontend Streaming Error - Implementation Fix Guide

**Issue:** `ReferenceError: accumulatedContent is not defined`
**Severity:** Critical
**Impact:** Chat streaming fails ungracefully when errors occur
**Status:** Requires Frontend Implementation

---

## 🔍 Problem Description

### The Error
```
ReferenceError: accumulatedContent is not defined
```

This error appears in the browser console when:
- A chat stream encounters an error
- The error handler tries to access `accumulatedContent` variable
- The variable is not in scope or not initialized

### Root Cause

The frontend error handler attempts to access the `accumulatedContent` variable when the stream fails, but:
1. The variable is not initialized in the correct scope
2. The variable may be declared inside a try block but accessed in catch block
3. No state management object wraps the streaming variables

**Note:** The backend correctly initializes `accumulated_content = ""` at `chat.py:151` - this is a frontend-only issue.

---

## 🛠️ The Solution

We'll implement a **ChatStreamHandler** class to manage streaming state and ensure all variables are always accessible in error handlers.

### Architecture Pattern

```
ChatStreamHandler (Class)
├── state (Object)
│   ├── isStreaming: boolean
│   ├── accumulatedContent: string (always accessible)
│   ├── chunkCount: number
│   └── errors: Error[]
├── reset() - Clear for new message
├── addChunk() - Append content
└── addError() - Log error with context
```

---

## 📝 Implementation Steps

### Step 1: Create the Stream Handler Class

Create a new file: `src/lib/chat-stream-handler.ts`

```typescript
/**
 * Manages streaming state for chat completions
 * Ensures all state is accessible in error handlers
 */
export class ChatStreamHandler {
  public state: {
    isStreaming: boolean;
    accumulatedContent: string;
    chunkCount: number;
    errors: Array<{
      message: string;
      timestamp: number;
      accumulatedContent: string;
    }>;
  };

  constructor() {
    this.state = {
      isStreaming: false,
      accumulatedContent: "",
      chunkCount: 0,
      errors: []
    };
  }

  /**
   * Reset state for a new message
   */
  reset() {
    this.state.accumulatedContent = "";
    this.state.chunkCount = 0;
    this.state.errors = [];
  }

  /**
   * Add a chunk of content to the accumulated result
   */
  addChunk(content: string | null | undefined) {
    if (content) {
      this.state.accumulatedContent += content;
      this.state.chunkCount++;
    }
  }

  /**
   * Log an error with the current accumulated content
   */
  addError(error: Error | unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    this.state.errors.push({
      message: errorMessage,
      timestamp: Date.now(),
      accumulatedContent: this.state.accumulatedContent
    });
  }

  /**
   * Get the final result
   */
  getResult() {
    return {
      content: this.state.accumulatedContent,
      chunkCount: this.state.chunkCount,
      errors: this.state.errors
    };
  }
}
```

---

### Step 2: Update Chat API Endpoint

Update your chat completion endpoint to use the handler.

**Example: `src/app/api/chat/completions/route.ts` (or wherever your streaming logic is)**

```typescript
import { ChatStreamHandler } from '@/lib/chat-stream-handler';

export async function POST(request: Request) {
  const handler = new ChatStreamHandler();

  try {
    const body = await request.json();
    const { messages, model, stream = true } = body;

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: { message: 'Messages array is required' } },
        { status: 400 }
      );
    }

    // Get API key from headers or session
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return Response.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Call backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const response = await fetch(`${backendUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ messages, model, stream })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed: ${response.status}`);
    }

    if (stream && response.body) {
      // Stream response
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Non-streaming response
      const data = await response.json();
      return Response.json(data);
    }

  } catch (error) {
    // ✅ Handler ensures accumulatedContent is always accessible
    handler.addError(error);

    console.error('Chat completion error:', {
      error: error instanceof Error ? error.message : String(error),
      accumulated: handler.state.accumulatedContent,
      chunks: handler.state.chunkCount
    });

    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'An error occurred',
          type: 'api_error'
        }
      },
      { status: 500 }
    );
  }
}
```

---

### Step 3: Update Client-Side Chat Component

Update your chat component to use proper error handling.

**Example: `src/components/chat/chat-interface.tsx`**

```typescript
import { ChatStreamHandler } from '@/lib/chat-stream-handler';
import { useToast } from '@/hooks/use-toast';

export function ChatInterface() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage(content: string, model: string) {
    const handler = new ChatStreamHandler();
    setIsLoading(true);

    try {
      const apiKey = localStorage.getItem('gatewayz_api_key');
      if (!apiKey) {
        throw new Error('Please sign in to send messages');
      }

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          model: model,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
          errorData.detail ||
          `Request failed: ${response.status}`
        );
      }

      // Process stream
      await processStream(response, handler);

      // Success!
      return {
        success: true,
        content: handler.state.accumulatedContent,
        chunkCount: handler.state.chunkCount
      };

    } catch (error) {
      // ✅ accumulatedContent is ALWAYS accessible here
      handler.addError(error);

      console.error('Message failed:', {
        error: error instanceof Error ? error.message : String(error),
        accumulated: handler.state.accumulatedContent,
        chunks: handler.state.chunkCount
      });

      // Show user-friendly error
      toast({
        title: "Message failed",
        description: getErrorMessage(error),
        variant: "destructive"
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        partialContent: handler.state.accumulatedContent
      };

    } finally {
      setIsLoading(false);
    }
  }

  async function processStream(response: Response, handler: ChatStreamHandler) {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    handler.reset();
    handler.state.isStreaming = true;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();

            // Check for stream end
            if (jsonStr === '[DONE]') {
              break;
            }

            try {
              const data = JSON.parse(jsonStr);

              // Handle errors from backend
              if (data.error) {
                throw new Error(data.error.message || 'Stream error');
              }

              // Extract content
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                handler.addChunk(content);

                // Update UI (use your state management solution)
                updateChatMessage(handler.state.accumulatedContent);
              }

            } catch (parseError) {
              console.warn('Failed to parse chunk:', parseError);
              // Continue processing other chunks
            }
          }
        }
      }
    } finally {
      handler.state.isStreaming = false;
      reader.releaseLock();
    }
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Map backend errors to user-friendly messages
      if (error.message.includes('Upstream rejected')) {
        return 'This model is temporarily unavailable. Please try another model.';
      }
      if (error.message.includes('rate limit')) {
        return 'Rate limit exceeded. Please wait a moment and try again.';
      }
      if (error.message.includes('credits')) {
        return 'Insufficient credits. Please add credits to continue.';
      }
      return 'Something went wrong. Please try again.';
    }
    return 'An unexpected error occurred.';
  }

  // ... rest of component
}
```

---

## ✅ Testing Checklist

After implementing the fix, test these scenarios:

### 1. Normal Operation
- [ ] Send a regular message
- [ ] Verify streaming works correctly
- [ ] Check content is displayed properly
- [ ] No errors in browser console

### 2. Model Unavailability (400 Error)
- [ ] Select a model that may be unavailable (e.g., `deepseek-ai/DeepSeek-R1` with Near gateway)
- [ ] Send a message
- [ ] Verify: User sees friendly error message
- [ ] Verify: No `ReferenceError` in console
- [ ] Verify: Partial content (if any) is logged

### 3. Network Failure
- [ ] Start sending a message
- [ ] Disable network mid-stream
- [ ] Verify: Graceful error handling
- [ ] Verify: No undefined variable errors
- [ ] Re-enable network and retry

### 4. Invalid Responses
- [ ] Test with malformed JSON in stream (if possible to simulate)
- [ ] Verify: Individual bad chunks are skipped
- [ ] Verify: Streaming continues for valid chunks
- [ ] Verify: No crashes or undefined errors

### 5. Browser Console
- [ ] Check for any `ReferenceError`
- [ ] Check for any `undefined` errors
- [ ] Verify error logs include accumulated content
- [ ] Verify error logs are helpful for debugging

---

## 🔧 Common Implementation Mistakes

### ❌ Bad: Loose Variables Outside Scope
```typescript
let accumulatedContent = "";

async function sendMessage() {
  try {
    // Stream processing...
    accumulatedContent += chunk;
  } catch (error) {
    // This might work, but error handler in different function won't
    console.error(accumulatedContent);
  }
}

// ❌ Error handler in different context
function onStreamError(error) {
  console.error(accumulatedContent); // ReferenceError!
}
```

### ✅ Good: State Object Always Accessible
```typescript
const handler = new ChatStreamHandler();

async function sendMessage() {
  try {
    // Stream processing...
    handler.addChunk(chunk);
  } catch (error) {
    console.error(handler.state.accumulatedContent); // ✅ Always works
  }
}

function onStreamError(error) {
  console.error(handler.state.accumulatedContent); // ✅ Always accessible
}
```

---

## 📊 Expected Outcomes

After implementing this fix:

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| Normal stream | ✅ Works | ✅ Works |
| Model unavailable (400) | ❌ ReferenceError | ✅ Friendly error message |
| Network failure | ❌ ReferenceError | ✅ Graceful error handling |
| Invalid JSON chunk | ❌ Stream crashes | ✅ Skip bad chunk, continue |
| Error logging | ❌ Missing context | ✅ Full context with partial content |
| User experience | ❌ Confusing errors | ✅ Clear, actionable messages |

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] No `ReferenceError` in any scenario
- [ ] Error messages are user-friendly
- [ ] Partial content logged for debugging
- [ ] Code review completed
- [ ] QA testing completed
- [ ] Monitoring/alerts configured for stream errors

---

## 📚 Additional Resources

### Related Files
- `src/lib/chat-stream-handler.ts` - Stream handler class (create this)
- `src/app/api/chat/completions/route.ts` - API endpoint (update this)
- `src/components/chat/chat-interface.tsx` - Chat UI (update this)

### Backend Context
- Backend initialization is correct: `accumulated_content = ""` at `chat.py:151`
- Backend properly handles stream errors
- No backend changes required

### Error Types
- `400 "Upstream rejected"` - Model not available on gateway (expected)
- `ReferenceError` - Frontend variable scope issue (this fix addresses)
- `429 Rate limit` - Too many requests (handle gracefully)
- `402 Payment required` - Insufficient credits (show clear message)

---

## 💡 Pro Tips

1. **Always initialize state in constructor** - Never rely on variables being set later
2. **Use TypeScript** - Catch scope issues at compile time
3. **Log accumulated content on errors** - Essential for debugging partial failures
4. **Show friendly messages to users** - Don't expose technical errors
5. **Test error scenarios** - Don't just test the happy path

---

## 🆘 Troubleshooting

### Still seeing ReferenceError?
- Check all error handlers reference `handler.state.accumulatedContent`
- Search codebase for loose `accumulatedContent` variables
- Ensure handler is passed to all functions that need it

### Partial content not showing?
- Verify `handler.addChunk()` is called for each chunk
- Check `handler.state.accumulatedContent` is logged in errors
- Ensure handler is not being reset mid-stream

### Error messages not user-friendly?
- Implement `getErrorMessage()` helper function
- Map backend error codes to friendly messages
- Test all error scenarios with real users

---

**Implementation Status:** Ready for development
**Estimated Time:** 2-4 hours for full implementation and testing
**Priority:** High - Affects production user experience
