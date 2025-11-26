import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamChatResponse } from '@/lib/streaming';
import { ChatStreamHandler } from '@/lib/chat-stream-handler';
import { useSaveMessage } from '@/lib/hooks/use-chat-queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { ModelOption } from '@/components/chat/model-select';
import { ChatMessage } from '@/lib/chat-history';

export function useChatStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const streamHandlerRef = useRef<ChatStreamHandler>(new ChatStreamHandler());
    const { apiKey } = useAuthStore();
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
        if (!apiKey) throw new Error("No API Key");

        setIsStreaming(true);
        streamHandlerRef.current.reset();

        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['chat-messages', sessionId] });

        // 1. Save User Message (Optimistic Update handled by useSaveMessage mutation, but we do it manually here for immediate UI)
        // Actually, let's update the cache manually for immediate feedback
        const userMsg: Partial<ChatMessage> = {
            role: 'user',
            content: typeof content === 'string' ? content : 'Sent an image/file', // Simplification for now
            model: model.value,
            created_at: new Date().toISOString()
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

        const url = `/api/chat/completions?session_id=${sessionId}`;

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
                
                // Throttle UI updates (every 50ms)
                if (Date.now() - lastUpdate > 50 || chunk.done) {
                    const currentContent = streamHandlerRef.current.getFinalContent();
                    const currentReasoning = streamHandlerRef.current.getFinalReasoning();

                    queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                        if (!old) return [];
                        const last = old[old.length - 1];
                        if (last.role !== 'assistant') return old; 

                        return [...old.slice(0, -1), {
                            ...last,
                            content: currentContent,
                            reasoning: currentReasoning
                        }];
                    });
                    lastUpdate = Date.now();
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
            // Add error message to chat
            queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                if (!old) return [];
                const last = old[old.length - 1];
                 return [...old.slice(0, -1), {
                    ...last,
                    content: last.content + `\n\n[Error: ${e instanceof Error ? e.message : "Failed to complete response"}]`,
                    isStreaming: false
                }];
            });
        } finally {
            setIsStreaming(false);
        }

    }, [apiKey, queryClient, saveMessage]);

    return {
        isStreaming,
        streamMessage
    };
}
