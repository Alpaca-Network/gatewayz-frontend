# AI SDK Chain-of-Thought Integration - Implementation Checklist

This checklist guides you through implementing the AI SDK integration for chain-of-thought reasoning in your chat and playground.

## Phase 1: Setup & Configuration

### Environment & Dependencies
- [ ] Add environment variables to `.env` and `.env.local`:
  ```bash
  AI_SDK_API_KEY=your-api-key-here
  AI_SDK_BASE_URL=https://api.anthropic.com/v1
  ```
- [ ] Review `package.json` - no new packages needed (AI SDK integration is library-agnostic)
- [ ] Review `.gitignore` to ensure `.env` is excluded

### File Structure Verification
- [ ] Verify these files were created:
  - `src/lib/ai-sdk-gateway.ts` - Core gateway wrapper
  - `src/lib/ai-sdk-chat-service.ts` - Chat service layer
  - `src/hooks/useAISDKChat.ts` - React hook
  - `src/hooks/useGatewayRouter.ts` - Gateway routing hook
  - `src/context/gateway-context.tsx` - Context provider
  - `src/app/api/chat/ai-sdk/route.ts` - API endpoint
  - `src/components/chat/ai-sdk-model-option.tsx` - Model option component
  - `src/components/chat/ai-sdk-example.tsx` - Example implementation
- [ ] Verify `src/components/chat/reasoning-display.tsx` was updated

## Phase 2: API Endpoint Integration

### Server-Side Setup
- [ ] Test the AI SDK API endpoint:
  ```bash
  curl -X POST http://localhost:3000/api/chat/ai-sdk \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -d '{
      "messages": [{"role": "user", "content": "Hello"}],
      "model": "claude-3-5-sonnet",
      "enable_thinking": true
    }'
  ```
- [ ] Verify stream response contains proper SSE format
- [ ] Test error handling for invalid models
- [ ] Test error handling for missing API key

### Request/Response Format
- [ ] Verify request body matches expected format
- [ ] Verify response streaming works correctly
- [ ] Check that reasoning chunks are properly parsed
- [ ] Verify done signal terminates stream properly

## Phase 3: Chat Page Integration

### Model Selection
- [ ] Import `getAISDKAvailableModels()` in chat page
- [ ] Add AI SDK models to model selector options
- [ ] Display "Thinking" badge for models that support it
- [ ] Test model selection dropdown with AI SDK models
- [ ] Verify model selection persists during conversation

### Request Routing
- [ ] Import `useGatewayRouter()` in chat page
- [ ] Create condition to detect AI SDK models:
  ```typescript
  const { isAISDK, supportsThinking } = useGatewayRouter();
  const useAISDK = isAISDK(selectedModel.value);
  ```
- [ ] Update message sending logic to route to correct endpoint
- [ ] Pass `enable_thinking: true` for supporting models
- [ ] Test switching between AI SDK and Gatewayz models

### Stream Handling
- [ ] Update stream parsing to handle both gateways:
  ```typescript
  if (useAISDK) {
    yield* streamAISDKChat({ ... })
  } else {
    yield* streamChatResponse({ ... })
  }
  ```
- [ ] Test reasoning content is properly extracted
- [ ] Test content streaming works with reasoning
- [ ] Verify both content and reasoning display correctly

### UI Updates
- [ ] Update message display to show reasoning:
  ```tsx
  {message.reasoning && (
    <ReasoningDisplay
      reasoning={message.reasoning}
      source="ai-sdk"
      isStreaming={false}
    />
  )}
  <p>{message.content}</p>
  ```
- [ ] Test ReasoningDisplay expands automatically during streaming
- [ ] Test toggle functionality for reasoning display
- [ ] Verify "AI SDK" badge shows on ReasoningDisplay

## Phase 4: Playground Integration

### Playground Setup
- [ ] Locate playground component(s)
- [ ] Identify similar chat flow to main chat page
- [ ] Import same AI SDK utilities and hooks
- [ ] Apply same integration pattern as chat page

### Playground-Specific Features
- [ ] Add model selector with AI SDK support
- [ ] Implement thinking parameter toggle
- [ ] Add temperature/max_tokens controls
- [ ] Display reasoning with enhanced component
- [ ] Test streaming display in playground

## Phase 5: Testing

### Unit Tests
- [ ] Test `modelSupportsThinking()` function
- [ ] Test message format conversion functions
- [ ] Test gateway router hook logic
- [ ] Test stream parsing for different response formats

### Integration Tests
- [ ] Test end-to-end with Claude 3.5 Sonnet
- [ ] Test with a non-thinking model (GPT-4o)
- [ ] Test switching models mid-conversation
- [ ] Test reasoning display toggle functionality
- [ ] Test streaming interruption/cancellation

### Manual Testing
#### Chain-of-Thought Functionality
1. [ ] Open chat, select Claude 3.5 Sonnet
2. [ ] Verify "Thinking" badge appears
3. [ ] Send message: "Explain photosynthesis in detail"
4. [ ] Verify reasoning starts streaming immediately
5. [ ] Verify reasoning displays in separate section
6. [ ] Verify content appears after reasoning
7. [ ] Toggle reasoning visibility with chevron button
8. [ ] Verify UI shows "Thinking..." while streaming

#### Model Switching
1. [ ] Start conversation with Claude 3.5 Sonnet
2. [ ] Switch to GPT-4o
3. [ ] Verify "Thinking" badge disappears
4. [ ] Send message
5. [ ] Verify no reasoning section appears
6. [ ] Switch back to Claude
7. [ ] Verify reasoning reappears for new messages

#### Error Handling
1. [ ] Test with invalid API key
2. [ ] Test with invalid model name
3. [ ] Test network interruption
4. [ ] Test timeout scenario
5. [ ] Verify error messages are helpful

#### Performance
1. [ ] Test with multiple messages
2. [ ] Verify streaming latency is acceptable
3. [ ] Check memory usage with long conversations
4. [ ] Test on mobile devices (if applicable)

## Phase 6: Documentation & Cleanup

### Documentation
- [ ] Review `AI_SDK_INTEGRATION.md` for accuracy
- [ ] Update CLAUDE.md with AI SDK information
- [ ] Add code comments for complex logic
- [ ] Document any deviations from the plan
- [ ] Create user-facing documentation if needed

### Code Quality
- [ ] Run linter: `pnpm lint`
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Review TypeScript types for completeness
- [ ] Check for console.log statements (remove non-essential)
- [ ] Verify no hardcoded API keys or secrets

### Backward Compatibility
- [ ] Verify all existing models still work
- [ ] Test existing chat features (image upload, etc.)
- [ ] Verify session persistence
- [ ] Check chat history migration (if needed)
- [ ] Test with different browsers

## Phase 7: Deployment

### Pre-Deployment
- [ ] Create feature flag for AI SDK (optional)
- [ ] Set up monitoring/logging for AI SDK API calls
- [ ] Configure API key rotation policy
- [ ] Plan rollback strategy

### Deployment Steps
- [ ] Merge to staging branch
- [ ] Deploy to staging environment
- [ ] Run full smoke tests
- [ ] Get stakeholder approval
- [ ] Deploy to production
- [ ] Monitor error rates and performance
- [ ] Gather user feedback

### Post-Deployment
- [ ] Monitor API usage and costs
- [ ] Track error rates for new endpoint
- [ ] Collect user feedback on reasoning display
- [ ] Plan future enhancements

## Optional Enhancements (Not in MVP)

- [ ] **Tool Use**: Add tool calling support for AI SDK models
- [ ] **Vision Support**: Enable image understanding with models that support it
- [ ] **Structured Output**: Add JSON schema support
- [ ] **Cost Dashboard**: Track API usage and costs
- [ ] **Conversation Export**: Export reasoning with conversations
- [ ] **Reasoning Analysis**: Analyze and display reasoning complexity
- [ ] **Multi-turn Reasoning**: Chain multiple reasoning steps
- [ ] **Model Comparison**: Compare reasoning from different models
- [ ] **Reasoning Templates**: Pre-defined prompts for specific reasoning types

## Rollback Plan

If issues arise:

1. [ ] Disable AI SDK model selection in UI
2. [ ] Set environment variable `DISABLE_AI_SDK=true`
3. [ ] Revert API endpoint to accept only Gatewayz requests
4. [ ] Monitor error recovery
5. [ ] Restore from backup if data issues

## Success Criteria

Your implementation is complete when:

- ✅ AI SDK models appear in model selector with "Thinking" badge
- ✅ Chain-of-thought reasoning displays during streaming
- ✅ Reasoning can be toggled visible/hidden
- ✅ Both AI SDK and Gatewayz models work seamlessly
- ✅ All existing features continue working
- ✅ No console errors related to AI SDK
- ✅ Tests pass: `pnpm test` and `pnpm typecheck`
- ✅ Performance is acceptable (< 100ms extra latency)
- ✅ Documentation is complete and accurate

## Support & Troubleshooting

### Common Issues

**Issue: "AI SDK API error: 401 Unauthorized"**
- Solution: Verify `AI_SDK_API_KEY` is set correctly
- Check: API key is not expired or revoked

**Issue: Reasoning not appearing**
- Solution: Check if selected model supports thinking
- Debug: Check browser console for parse errors
- Check: Verify `enable_thinking` is true in request

**Issue: Streaming stops unexpectedly**
- Solution: Check network tab for failed requests
- Debug: Monitor server logs for errors
- Check: Verify API key still valid

**Issue: Memory leak with long conversations**
- Solution: Clear old messages periodically
- Check: Verify message arrays are not growing unbounded

### Debug Mode

Enable detailed logging:
```typescript
// In any file using AI SDK
localStorage.setItem('DEBUG_AI_SDK', 'true')

// Watch console for [AI SDK] prefixed messages
```

## Questions & Support

For issues or questions:
1. Check `AI_SDK_INTEGRATION.md` documentation
2. Review example component: `ai-sdk-example.tsx`
3. Check console for error messages
4. Verify environment configuration
5. Test with curl command before debugging UI
