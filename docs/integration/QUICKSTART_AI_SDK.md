# AI SDK Chain-of-Thought - Quick Start Guide

**Get chain-of-thought reasoning working in 5 minutes!**

## 1️⃣ Configure Environment (1 minute)

Add to `.env.local`:
```bash
AI_SDK_API_KEY=sk-ant-xxxxxxxxxxxxxx
AI_SDK_BASE_URL=https://api.anthropic.com/v1
```

## 2️⃣ Update Chat Page (3 minutes)

Replace your chat message sending logic with this:

```typescript
import { useGatewayRouter } from '@/hooks/useGatewayRouter';
import { streamAISDKChat, getAISDKAvailableModels } from '@/lib/ai-sdk-chat-service';

// In your chat component:
const { isAISDK, supportsThinking } = useGatewayRouter();
const aiSdkModels = getAISDKAvailableModels();

// Add AI SDK models to your selector:
const allModels = [...existingModels, ...aiSdkModels];

// When sending message:
async function sendMessage(userMessage: string) {
  const useAISDK = isAISDK(selectedModel);

  if (useAISDK) {
    // Use AI SDK
    for await (const chunk of streamAISDKChat({
      model: selectedModel,
      messages: [...messages, { role: 'user', content: userMessage }],
      enableThinking: supportsThinking(selectedModel),
      apiKey: userApiKey,
    })) {
      if (chunk.reasoning) updateReasoningDisplay(chunk.reasoning);
      if (chunk.content) updateContentDisplay(chunk.content);
    }
  } else {
    // Use existing Gatewayz
    yield* streamChatResponse(...);
  }
}
```

## 3️⃣ Display Reasoning (1 minute)

In your message rendering:
```tsx
import { ReasoningDisplay } from '@/components/chat/reasoning-display';

{message.reasoning && (
  <ReasoningDisplay
    reasoning={message.reasoning}
    source="ai-sdk"
  />
)}
<p>{message.content}</p>
```

## 4️⃣ Test It!

1. Start your dev server: `pnpm dev`
2. Open chat page
3. Select "Claude 3.5 Sonnet" from model selector
4. Notice the "Thinking" badge appears
5. Type: "What are the first 5 prime numbers? Think step by step."
6. Watch reasoning appear as it streams!
7. Toggle reasoning visibility with the chevron button

## Done! 🎉

That's it! You now have chain-of-thought reasoning working in your chat.

## File Reference

All code is in these locations - **no breaking changes to existing code**:

| What | Where | Purpose |
|------|-------|---------|
| Gateway logic | `src/lib/ai-sdk-gateway.ts` | Core AI SDK wrapper |
| Chat service | `src/lib/ai-sdk-chat-service.ts` | Stream handler |
| React hook | `src/hooks/useAISDKChat.ts` | Component integration |
| Router hook | `src/hooks/useGatewayRouter.ts` | Gateway detection |
| Context | `src/context/gateway-context.tsx` | State management |
| API endpoint | `src/app/api/chat/ai-sdk/route.ts` | Streaming endpoint |
| UI component | `src/components/chat/ai-sdk-model-option.tsx` | Model selector |
| Example | `src/components/chat/ai-sdk-example.tsx` | Full working example |
| Enhanced UI | `src/components/chat/reasoning-display.tsx` | ✏️ Updated |

## Supported Models

- ✅ **Claude 3.5 Sonnet** - Extended thinking (recommended)
- ✅ **Claude Opus 4** - Extended thinking
- ✅ **GPT-4o** - Content only
- ✅ **GPT-4 Turbo** - Content only
- ✅ **Gemini 1.5 Pro** - Content only

Add more in `src/lib/ai-sdk-chat-service.ts`

## Troubleshooting

**Reasoning not showing?**
- Check model supports thinking (Claude 3.5 Sonnet)
- Verify `enable_thinking: true` is set
- Check browser console for errors

**API errors?**
- Verify `AI_SDK_API_KEY` is set
- Check API key is valid and not expired
- Ensure model name is correct

**TypeScript errors?**
- Run: `pnpm typecheck`
- Check imports match exactly

## Full Docs

- **Integration Guide**: `AI_SDK_INTEGRATION.md`
- **Checklist**: `AI_SDK_IMPLEMENTATION_CHECKLIST.md`
- **Full Summary**: `AI_SDK_INTEGRATION_SUMMARY.md`
- **Working Example**: `src/components/chat/ai-sdk-example.tsx`

## Next Steps

1. ✅ Get basic integration working (you are here)
2. ⬜ Add to playground component (same pattern as chat)
3. ⬜ Test with more models
4. ⬜ Add thinking toggle in settings
5. ⬜ Monitor API usage/costs

## Questions?

1. Check the full documentation files
2. Review `ai-sdk-example.tsx` for working code
3. See `AI_SDK_INTEGRATION.md` for detailed info
4. Check error messages in browser console

---

**Happy reasoning!** 🧠✨
