import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamChatResponse } from '@/lib/streaming';
import { ChatStreamHandler } from '@/lib/chat-stream-handler';
import { useSaveMessage } from '@/lib/hooks/use-chat-queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { getApiKey } from '@/lib/api';
import { ModelOption } from '@/components/chat/model-select';
import { ChatMessage } from '@/lib/chat-history';

// Helper to extract image/video/audio from content array for display
const extractMediaFromContent = (content: any): { image?: string; video?: string; audio?: string } => {
    if (!Array.isArray(content)) return {};
    const result: { image?: string; video?: string; audio?: string } = {};
    for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
            result.image = part.image_url.url;
        } else if (part.type === 'video_url' && part.video_url?.url) {
            result.video = part.video_url.url;
        } else if (part.type === 'audio_url' && part.audio_url?.url) {
            result.audio = part.audio_url.url;
        }
    }
    return result;
};

export function useChatStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);
    const streamHandlerRef = useRef<ChatStreamHandler>(new ChatStreamHandler());
    const saveMessage = useSaveMessage();
    const queryClient = useQueryClient();

    const streamMessage = useCallback(async ({
        sessionId,
        content,
        model,
        messagesHistory
    }: {
        sessionId: number,
        content: any,
        model: ModelOption,
        messagesHistory: any[]
    }) => {
        // IMPORTANT: Use getState() for imperative access to avoid stale closure issues
        // The previous approach captured storeApiKey at render time, which could be null
        // even when auth had completed but the component hadn't re-rendered yet.
        // This pattern ensures we always get the latest auth state at execution time.
        const storeApiKey = useAuthStore.getState().apiKey;
        // Try store first, fall back to localStorage for auth state desync fix
        const apiKey = storeApiKey || getApiKey();
        if (!apiKey) throw new Error("No API Key");

        setIsStreaming(true);
        setStreamError(null);
        streamHandlerRef.current.reset();

        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['chat-messages', sessionId] });

        // Extract media attachments for proper display
        const mediaAttachments = extractMediaFromContent(content);

        // 1. Save User Message with full content (including attachments)
        // Store the actual content for display, not a placeholder
        const userMsg: Partial<ChatMessage> & { image?: string; video?: string; audio?: string } = {
            role: 'user',
            content: content, // Store full content (string or array)
            model: model.value,
            created_at: new Date().toISOString(),
            ...mediaAttachments // Include extracted media for easy rendering
        };

        queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
            return [...(old || []), userMsg];
        });

        // Fire and forget save
        saveMessage.mutate({ sessionId, role: 'user', content, model: model.value });

        // 2. Add Optimistic Assistant Message
        const assistantMsg: Partial<ChatMessage> & { isStreaming?: boolean, reasoning?: string } = {
            role: 'assistant',
            content: '',
            model: model.value,
            created_at: new Date().toISOString(),
            isStreaming: true
        };

        queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
            return [...(old || []), assistantMsg];
        });

        // 3. Prepare Request
        // We need to format the messages history for the API
        // messagesHistory typically comes from the cache, which matches the API format usually.
        // We just need to ensure we append the NEW user message.
        const apiMessages = [...messagesHistory, { role: 'user', content }];

        const requestBody: any = {
            model: model.value,
            messages: apiMessages,
            stream: true,
            max_tokens: 8000,
            gateway: model.sourceGateway
        };
        
        // Portkey provider logic (copied from original)
        if (model.sourceGateway === 'portkey') {
             const modelValue = model.value.toLowerCase();
             if (modelValue.includes('gpt') || modelValue.includes('o1')) requestBody.portkey_provider = 'openai';
             else if (modelValue.includes('claude')) requestBody.portkey_provider = 'anthropic';
             else if (modelValue.includes('deepinfra') || modelValue.includes('wizardlm')) requestBody.portkey_provider = 'deepinfra';
        }

        // Use AI SDK route for all models
        // This enables proper streaming and chain-of-thought support via Vercel AI SDK
        const url = `/api/chat/ai-sdk-completions?session_id=${sessionId}`;

        console.log('[Chat Stream] Using AI SDK route for model:', model.value);

        try {
            // 4. Stream Loop
            let lastUpdate = Date.now();

            for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
                if (chunk.content) {
                    streamHandlerRef.current.processContentWithThinking(String(chunk.content));
                }
                if (chunk.reasoning) {
                    streamHandlerRef.current.addReasoning(String(chunk.reasoning));
                }

                // Throttle UI updates (every 50ms) - use requestAnimationFrame timing
                const now = Date.now();
                if (now - lastUpdate > 50 || chunk.done) {
                    const currentContent = streamHandlerRef.current.getFinalContent();
                    const currentReasoning = streamHandlerRef.current.getFinalReasoning();

                    queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                        if (!old) return [];
                        const last = old[old.length - 1];
                        if (last.role !== 'assistant') return old;

                        return [...old.slice(0, -1), {
                            ...last,
                            content: currentContent,
                            reasoning: currentReasoning,
                            isStreaming: true, // Ensure streaming flag stays true during updates
                        }];
                    });
                    lastUpdate = now;

                    // Yield to the event loop to allow React to re-render
                    // This is critical for real-time streaming updates
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // 5. Finalize
            const finalContent = streamHandlerRef.current.getFinalContent();
            
            // Save Assistant Message
            saveMessage.mutate({ 
                 sessionId, 
                 role: 'assistant', 
                 content: finalContent, 
                 model: model.value 
            });
            
            // Mark isStreaming false
            queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                if (!old) return [];
                const last = old[old.length - 1];
                return [...old.slice(0, -1), { ...last, isStreaming: false }];
            });

        } catch (e) {
            console.error("Streaming failed", e);
            const errorMessage = e instanceof Error ? e.message : "Failed to complete response";
            setStreamError(errorMessage);

            // Mark the assistant message as failed with error metadata, not appended to content
            queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                if (!old) return [];
                const last = old[old.length - 1];
                if (last.role !== 'assistant') return old;

                return [...old.slice(0, -1), {
                    ...last,
                    content: last.content || '', // Keep existing content if any
                    isStreaming: false,
                    error: errorMessage, // Store error separately, not in content
                    hasError: true
                }];
            });
        } finally {
            setIsStreaming(false);
        }

    }, [queryClient, saveMessage]);

    return {
        isStreaming,
        streamError,
        streamMessage
    };
}
