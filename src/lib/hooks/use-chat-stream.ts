import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
// Using modular streaming - the old streaming.ts is deprecated
import { streamChatResponse } from '@/lib/streaming/index';
import { ChatStreamHandler } from '@/lib/chat-stream-handler';
import { useSaveMessage } from '@/lib/hooks/use-chat-queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { getApiKey } from '@/lib/api';
import { ModelOption } from '@/components/chat/model-select';
import { ChatMessage } from '@/lib/chat-history';

// Stream stopped error for clean cancellation
class StreamStoppedError extends Error {
    constructor() {
        super('Stream stopped by user');
        this.name = 'StreamStoppedError';
    }
}

// Debug logging helper - always logs in development, logs errors in production
const debugLog = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[ChatStream ${timestamp}]`;
    if (process.env.NODE_ENV === 'development') {
        console.log(prefix, message, data !== undefined ? data : '');
    }
};

const debugError = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[ChatStream ERROR ${timestamp}]`;
    console.error(prefix, message, data !== undefined ? data : '');
};

// Helper to extract image/video/audio/document from content array for display
const extractMediaFromContent = (content: any): { image?: string; video?: string; audio?: string; document?: string } => {
    if (!Array.isArray(content)) return {};
    const result: { image?: string; video?: string; audio?: string; document?: string } = {};
    for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
            result.image = part.image_url.url;
        } else if (part.type === 'video_url' && part.video_url?.url) {
            result.video = part.video_url.url;
        } else if (part.type === 'audio_url' && part.audio_url?.url) {
            result.audio = part.audio_url.url;
        } else if (part.type === 'file_url' && part.file_url?.url) {
            result.document = part.file_url.url;
        }
    }
    return result;
};

// Helper to check if a model supports a given modality
const modelSupportsModality = (modelModalities: string[] | undefined, modality: string): boolean => {
    if (!modelModalities || modelModalities.length === 0) {
        // If no modalities specified, assume text-only
        return modality.toLowerCase() === 'text';
    }
    return modelModalities.some(m => m.toLowerCase() === modality.toLowerCase());
};

// Helper to normalize message content for API requests
// When switching between models, multimodal content (arrays with images/audio/video)
// needs to be converted to text-only format for non-vision models
// If modelModalities is provided, we check if the model supports the content types
export const normalizeContentForApi = (content: any, modelModalities?: string[]): string | any[] => {
    // If content is a string, return as-is
    if (typeof content === 'string') {
        return content;
    }

    // If content is an array (multimodal format), check each part
    if (Array.isArray(content)) {
        // Check if model supports image/video/audio
        const supportsImage = modelSupportsModality(modelModalities, 'image');
        const supportsVideo = modelSupportsModality(modelModalities, 'video');
        const supportsAudio = modelSupportsModality(modelModalities, 'audio');
        const supportsFile = modelSupportsModality(modelModalities, 'file');

        // If model supports all modalities present in content, return as-is
        const hasImage = content.some(p => p.type === 'image_url');
        const hasVideo = content.some(p => p.type === 'video_url');
        const hasAudio = content.some(p => p.type === 'audio_url');
        const hasFile = content.some(p => p.type === 'file_url');

        const allSupported = (!hasImage || supportsImage) &&
                            (!hasVideo || supportsVideo) &&
                            (!hasAudio || supportsAudio) &&
                            (!hasFile || supportsFile);

        // If model supports all content types, return the original array
        if (allSupported) {
            return content;
        }

        // Otherwise, extract only text parts
        const textParts: string[] = [];
        let hasNonTextContent = false;

        for (const part of content) {
            if (part.type === 'text' && part.text) {
                textParts.push(part.text);
            } else if (part.type === 'image_url' || part.type === 'video_url' ||
                       part.type === 'audio_url' || part.type === 'file_url') {
                hasNonTextContent = true;
            }
        }

        // If there's non-text content that's being stripped, log it
        if (hasNonTextContent && textParts.length > 0) {
            debugLog('Normalizing multimodal content to text-only', {
                originalParts: content.length,
                textParts: textParts.length,
                hasNonTextContent,
                modelModalities,
                stripped: { hasImage, hasVideo, hasAudio, hasFile }
            });
            return textParts.join('\n');
        }

        // If only text parts, join them
        if (textParts.length > 0) {
            return textParts.join('\n');
        }

        // If no text content at all but model doesn't support the content types,
        // return empty string rather than unsupported content
        if (hasNonTextContent && !allSupported) {
            debugLog('Dropping unsupported multimodal content with no text', {
                modelModalities,
                contentTypes: { hasImage, hasVideo, hasAudio, hasFile }
            });
            return '';
        }

        // Fallback: return original content
        return content;
    }

    // Fallback: convert to string
    return String(content || '');
};

export function useChatStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);
    const streamHandlerRef = useRef<ChatStreamHandler>(new ChatStreamHandler());
    const abortControllerRef = useRef<AbortController | null>(null);
    const saveMessage = useSaveMessage();
    const queryClient = useQueryClient();

    // Stop the current stream
    const stopStream = useCallback(() => {
        debugLog('stopStream called', { hasController: !!abortControllerRef.current });
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

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
        debugLog('streamMessage called', { sessionId, model: model.value, messagesHistoryLength: messagesHistory.length });

        // IMPORTANT: Use getState() for imperative access to avoid stale closure issues
        // The previous approach captured storeApiKey at render time, which could be null
        // even when auth had completed but the component hadn't re-rendered yet.
        // This pattern ensures we always get the latest auth state at execution time.
        const { apiKey: storeApiKey, isAuthenticated } = useAuthStore.getState();
        const localStorageApiKey = getApiKey();

        debugLog('Auth state check', {
            hasStoreApiKey: !!storeApiKey,
            storeApiKeyPrefix: storeApiKey ? storeApiKey.substring(0, 15) + '...' : 'none',
            hasLocalStorageApiKey: !!localStorageApiKey,
            localStorageApiKeyPrefix: localStorageApiKey ? localStorageApiKey.substring(0, 15) + '...' : 'none',
            isAuthenticated
        });

        // Try store first, fall back to localStorage for auth state desync fix
        // For guest users, we use a special placeholder since they don't have API keys
        const apiKey = storeApiKey || localStorageApiKey || (isAuthenticated ? null : 'guest');

        debugLog('Final API key decision', {
            apiKeySource: storeApiKey ? 'store' : localStorageApiKey ? 'localStorage' : 'guest-fallback',
            apiKeyPrefix: apiKey ? apiKey.substring(0, 15) + '...' : 'none',
            isGuest: apiKey === 'guest'
        });

        if (!apiKey) {
            debugError('No API key available - throwing error');
            throw new Error("No API Key");
        }

        setIsStreaming(true);
        setStreamError(null);
        streamHandlerRef.current.reset();

        // Create new abort controller for this stream
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['chat-messages', sessionId] });

        // Extract media attachments for proper display
        const mediaAttachments = extractMediaFromContent(content);

        // 1. Save User Message with full content (including attachments)
        // Store the actual content for display, not a placeholder
        const userMsg: Partial<ChatMessage> & { image?: string; video?: string; audio?: string; document?: string } = {
            role: 'user',
            content: content, // Store full content (string or array)
            model: model.value,
            created_at: new Date().toISOString(),
            ...mediaAttachments // Include extracted media for easy rendering
        };

        queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
            return [...(old || []), userMsg];
        });

        // Fire and forget save - for authenticated users OR guest sessions (negative IDs)
        // Guest messages are saved to localStorage, authenticated to backend
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
        // messagesHistory comes from the cache and may contain UI-only fields
        // (isStreaming, wasStopped, hasError, error) that the backend doesn't expect.
        // We also need to filter out incomplete messages from stopped streams.
        const sanitizedHistory = messagesHistory
            .filter((msg: any) => {
                // Filter out messages that are still streaming
                if (msg.isStreaming) return false;
                // Filter out stopped messages without content
                if (msg.wasStopped && !msg.content) return false;
                // Filter out empty assistant messages (e.g., from stopped streams before any content arrived)
                // These may not have wasStopped set if the stop happened before finalization
                if (msg.role === 'assistant' && !msg.content) return false;
                return true;
            })
            .map((msg: any) => {
                // Extract only the fields the API expects: role, content, and optionally name
                // Normalize content to handle multimodal messages when switching models
                // This ensures messages with images/audio from vision models don't break
                // when the user switches to a text-only model
                const sanitized: { role: string; content: any; name?: string } = {
                    role: msg.role,
                    content: normalizeContentForApi(msg.content, model.modalities)
                };
                if (msg.name) sanitized.name = msg.name;
                return sanitized;
            });

        // Normalize the current user message content as well
        // This handles cases where user sends multimodal content to a text-only model
        const normalizedContent = normalizeContentForApi(content, model.modalities);
        const apiMessages = [...sanitizedHistory, { role: 'user', content: normalizedContent }];

        const requestBody: any = {
            model: model.value,
            messages: apiMessages,
            stream: true,
            max_tokens: 8000,
            gateway: model.sourceGateway,
            apiKey: apiKey  // Pass API key in request body as well as Authorization header
        };
        
        // Portkey provider logic (copied from original)
        if (model.sourceGateway === 'portkey') {
             const modelValue = model.value.toLowerCase();
             if (modelValue.includes('gpt') || modelValue.includes('o1')) requestBody.portkey_provider = 'openai';
             else if (modelValue.includes('claude')) requestBody.portkey_provider = 'anthropic';
             else if (modelValue.includes('deepinfra') || modelValue.includes('wizardlm')) requestBody.portkey_provider = 'deepinfra';
        }

        // Determine which route to use based on model/provider
        // Some providers return non-standard OpenAI formats that the AI SDK can't parse,
        // so we route them through the regular completions endpoint which has
        // more flexible format handling in streaming.ts
        const modelLower = model.value.toLowerCase();
        const gatewayLower = model.sourceGateway?.toLowerCase() || '';

        // Gateways that normalize responses to standard OpenAI Chat Completions format
        // These can use the AI SDK route safely
        const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
        const hasExplicitNormalizingPrefix = normalizingGateways.some(g => modelLower.startsWith(`${g}/`));
        const isNormalizingGateway = normalizingGateways.includes(gatewayLower);

        // Gateways/providers that return non-standard formats and need the flexible route:
        // - fireworks: returns Responses API format (object: "response.chunk" with output array)
        // - deepseek: returns Responses API format when accessed directly
        // - near: requires special backend handling via near_client.py
        // - chutes: custom model hosting with non-standard format
        // - aimo: research models with custom format
        // - fal: image/video models with different streaming format
        // - alibaba: Qwen models with custom format when accessed directly
        // - novita: GPU inference with custom format
        // - huggingface: HF Inference API has different streaming format
        // - alpaca: Alpaca Network with custom format
        // - clarifai: Clarifai gateway with custom format
        // - featherless: open-source model hosting with variable formats
        // - deepinfra: can have non-standard formats for some models
        const nonStandardGateways = [
            'fireworks',
            'deepseek',
            'near',
            'chutes',
            'aimo',
            'fal',
            'alibaba',
            'novita',
            'huggingface',
            'hug', // alias for huggingface
            'alpaca',
            'clarifai',
            'featherless',
            'deepinfra',
        ];

        // Check if model is from a non-standard gateway by:
        // 1. sourceGateway matches a non-standard gateway
        // 2. Model ID starts with a non-standard gateway prefix
        const isNonStandardGateway = nonStandardGateways.includes(gatewayLower) ||
            nonStandardGateways.some(gw => modelLower.startsWith(`${gw}/`));

        // Special case: Fireworks models with accounts/ prefix (fireworks/ prefix is already handled by nonStandardGateways)
        const isFireworksModel = modelLower.includes('accounts/fireworks');

        // If model goes through a normalizing gateway (OpenRouter, Together, etc.),
        // it's safe to use AI SDK even if the underlying provider is non-standard
        // Example: 'openrouter/deepseek/deepseek-r1' is normalized by OpenRouter
        // Trust explicit sourceGateway over model name prefix - if sourceGateway is a normalizing gateway, use AI SDK
        const isNormalizedByGateway = hasExplicitNormalizingPrefix || isNormalizingGateway;

        // Use flexible route for non-standard gateways UNLESS normalized by a gateway
        const useFlexibleRoute = (isNonStandardGateway || isFireworksModel) && !isNormalizedByGateway;
        const url = useFlexibleRoute
            ? `/api/chat/completions?session_id=${sessionId}`
            : `/api/chat/ai-sdk-completions?session_id=${sessionId}`;

        debugLog('Route selection', {
            useFlexibleRoute,
            isNonStandardGateway,
            isFireworksModel,
            isNormalizedByGateway,
            gatewayLower,
            url,
            model: model.value
        });
        console.log('[Chat Stream] Using', useFlexibleRoute ? 'completions (flexible)' : 'AI SDK', 'route for model:', model.value, 'gateway:', gatewayLower || 'none');

        try {
            // 4. Stream Loop
            let lastUpdate = Date.now();
            let chunkCount = 0;
            let totalContentLength = 0;
            let wasStopped = false;

            debugLog('Starting stream loop', { url, apiKeyPrefix: apiKey.substring(0, 15) + '...' });

            for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
                // Check if stream was stopped by user
                if (signal.aborted) {
                    debugLog('Stream aborted by user');
                    wasStopped = true;
                    break;
                }

                chunkCount++;

                if (chunkCount === 1) {
                    debugLog('First chunk received', {
                        hasContent: !!chunk.content,
                        hasReasoning: !!chunk.reasoning,
                        isDone: chunk.done,
                        status: chunk.status
                    });
                }

                if (chunk.content) {
                    totalContentLength += String(chunk.content).length;
                    streamHandlerRef.current.processContentWithThinking(String(chunk.content));
                }
                if (chunk.reasoning) {
                    streamHandlerRef.current.addReasoning(String(chunk.reasoning));
                }

                // Log every 10th chunk for debugging
                if (chunkCount % 10 === 0) {
                    debugLog('Stream progress', { chunkCount, totalContentLength });
                }

                // Throttle UI updates (every 16ms = ~60fps) for smooth streaming
                const now = Date.now();
                if (now - lastUpdate > 16 || chunk.done) {
                    const currentContent = streamHandlerRef.current.getFinalContent();
                    const currentReasoning = streamHandlerRef.current.getFinalReasoning();

                    // Use flushSync to force React to render immediately instead of batching
                    // This is critical for real-time streaming updates in React 18+
                    flushSync(() => {
                        queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                            if (!old || old.length === 0) return old || [];
                            const last = old[old.length - 1];
                            if (!last || last.role !== 'assistant') return old;

                            return [...old.slice(0, -1), {
                                ...last,
                                content: currentContent,
                                reasoning: currentReasoning,
                                isStreaming: true, // Ensure streaming flag stays true during updates
                            }];
                        });
                    });
                    lastUpdate = now;

                    // Yield to allow the browser to paint
                    // Use requestAnimationFrame with setTimeout fallback for background tabs
                    // RAF pauses when tab is backgrounded, so we race with a timeout
                    await new Promise(resolve => {
                        const timeoutId = setTimeout(resolve, 16);
                        requestAnimationFrame(() => {
                            clearTimeout(timeoutId);
                            resolve(undefined);
                        });
                    });
                }
            }

            // 5. Finalize
            const finalContent = streamHandlerRef.current.getFinalContent();
            const finalReasoning = streamHandlerRef.current.getFinalReasoning();

            debugLog(wasStopped ? 'Stream stopped by user' : 'Stream completed successfully', {
                totalChunks: chunkCount,
                finalContentLength: finalContent.length,
                hasReasoning: !!finalReasoning,
                reasoningLength: finalReasoning?.length || 0,
                wasStopped
            });

            // Save Assistant Message - for authenticated users OR guest sessions (negative IDs)
            // Guest messages are saved to localStorage, authenticated to backend
            // Include reasoning if present for proper persistence and display on reload
            // Only save if we have content (even if stopped mid-stream)
            if (finalContent) {
                saveMessage.mutate({
                     sessionId,
                     role: 'assistant',
                     content: finalContent,
                     model: model.value,
                     reasoning: finalReasoning || undefined
                });
            }

            // Mark isStreaming false and set wasStopped flag if applicable
            flushSync(() => {
                queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                    if (!old || old.length === 0) return old || [];
                    const last = old[old.length - 1];
                    if (!last) return old;
                    return [...old.slice(0, -1), {
                        ...last,
                        isStreaming: false,
                        wasStopped: wasStopped && finalContent ? true : undefined
                    }];
                });
            });

        } catch (e) {
            debugError("Streaming failed", {
                error: e instanceof Error ? e.message : String(e),
                errorType: e instanceof Error ? e.constructor.name : typeof e,
                stack: e instanceof Error ? e.stack : undefined
            });
            console.error("Streaming failed", e);
            const errorMessage = e instanceof Error ? e.message : "Failed to complete response";
            setStreamError(errorMessage);

            // Mark the assistant message as failed with error metadata, not appended to content
            flushSync(() => {
                queryClient.setQueryData(['chat-messages', sessionId], (old: any[] | undefined) => {
                    if (!old || old.length === 0) return old || [];
                    const last = old[old.length - 1];
                    if (!last || last.role !== 'assistant') return old;

                    return [...old.slice(0, -1), {
                        ...last,
                        content: last.content || '', // Keep existing content if any
                        isStreaming: false,
                        error: errorMessage, // Store error separately, not in content
                        hasError: true
                    }];
                });
            });
        } finally {
            setIsStreaming(false);
        }

    }, [queryClient, saveMessage]);

    return {
        isStreaming,
        streamError,
        streamMessage,
        stopStream
    };
}
