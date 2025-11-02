# TODO

## Chat Streaming Implementation

### Current Status
- ✅ Basic chat functionality working
- ✅ Model page caching (5-minute localStorage cache)
- ✅ Model selection from model pages (URL parameter)
- ✅ Markdown rendering with math support
- ⏳ Streaming responses with reasoning display (foundation laid, needs debugging)

### Next Steps for Streaming
1. **Debug Network Issues**
   - The streaming API route is set up in `src/app/api/chat/route.ts`
   - Client-side streaming handler exists in `src/lib/streaming-chat.ts`
   - "Failed to fetch" error needs investigation
   - Possible CORS or ReadableStream compatibility issue

2. **Streaming Message Component**
   - Component created: `src/components/chat/streaming-message.tsx`
   - Features collapsible reasoning display
   - Shows "thinking..." indicator
   - Displays estimated thinking time

3. **Files to Review**
   - `src/app/api/chat/route.ts` - Server-sent events (SSE) streaming
   - `src/lib/streaming-chat.ts` - Client-side stream parser
   - `src/components/chat/streaming-message.tsx` - UI component
   - `src/app/chat/page.tsx` - Integration point (currently using simple fetch)

4. **Testing Strategy**
   - Test with a model that supports reasoning (e.g., DeepSeek v3, OpenAI o1)
   - Verify SSE format matches what the client expects
   - Add error handling for stream interruptions
   - Test on different browsers for ReadableStream support

### Reference Implementation
See the backup file for streaming integration: `src/app/chat/page.tsx.backup`
