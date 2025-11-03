"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';
import { getApiKey, getUserData } from '@/lib/api';
import { streamChatResponse } from '@/lib/streaming';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { ReasoningDisplay } from '@/components/chat/reasoning-display';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  isStreaming?: boolean;
}

interface InlineChatProps {
  modelId: string;
  modelName: string;
  gateway?: string;
}

export function InlineChat({ modelId, modelName, gateway }: InlineChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    // Get API key and user data
    let apiKey = getApiKey();
    const userData = getUserData();

    // Development fallback: use env variable if API key not found (CORS issue on localhost)
    if (!apiKey && process.env.NODE_ENV === 'development') {
      apiKey = process.env.NEXT_PUBLIC_DEV_API_KEY || null;
      console.log('[InlineChat] Using development API key fallback');
    }

    if (!apiKey) {
      console.log('[InlineChat] No API key found in localStorage');
      console.log('[InlineChat] localStorage gatewayz_api_key:', localStorage.getItem('gatewayz_api_key'));
      console.log('[InlineChat] localStorage gatewayz_user_data:', localStorage.getItem('gatewayz_user_data'));
      setError('Authentication required. Please refresh the page or sign in again.');
      return;
    }

    // For development, we can proceed without userData.privy_user_id
    if (!userData?.privy_user_id && process.env.NODE_ENV !== 'development') {
      setError('Please sign in to use chat');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    // Add a streaming assistant message
    const streamingMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '', isStreaming: true }]);

    // Initialize accumulated content outside try block to ensure it's always in scope
    // This prevents ReferenceError when accessing these variables in catch handler
    let accumulatedContent = '';
    let accumulatedThinking = '';
    let inThinking = false;

    try {
      // Call the backend API directly to avoid Vercel's 60-second timeout
      // CORS headers are configured in vercel.json to allow beta.gatewayz.ai
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
      const url = typeof window !== 'undefined'
        ? '/api/chat/completions'
        : `${apiBaseUrl}/v1/chat/completions`;

      console.log('[InlineChat] Sending message to model:', modelId);
      console.log('[InlineChat] Gateway:', gateway || 'not specified');
      console.log('[InlineChat] Using API endpoint:', url);

      const requestBody = {
        model: modelId,
        ...(gateway && { gateway }), // Add gateway if provided
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: 0.7,
        max_tokens: 8000  // Increased for reasoning models like DeepSeek
      };
      // Use the streaming utility with proper error handling and retries
      for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
        // Enhanced logging to see what data we're receiving
        console.log('[InlineChat] Received chunk:', {
          hasContent: !!chunk.content,
          hasReasoning: !!chunk.reasoning,
          isDone: !!chunk.done,
          status: chunk.status,
          contentPreview: chunk.content ? chunk.content.substring(0, 50) : null,
          reasoningPreview: chunk.reasoning ? chunk.reasoning.substring(0, 50) : null
        });

        // Handle rate limit retries
        if (chunk.status === 'rate_limit_retry') {
          console.log('[InlineChat] Rate limit, retrying in', chunk.retryAfterMs, 'ms');
          continue;
        }

        // Process content with thinking tag extraction
        if (chunk.content) {
          const content = String(chunk.content);

          // Debug: Log content to see what we're receiving
          if (content.includes('<thinking') || content.includes('</thinking') || content.includes('[THINKING') || content.includes('<think') || content.includes('</think')) {
            console.log('[THINKING DEBUG]', { content, inThinking, length: content.length });
          }

          // Process content character by character to handle thinking tags correctly
          let normalizedContent = content
            .replace(/\[THINKING\]/gi, '<thinking>')
            .replace(/\[\/THINKING\]/gi, '</thinking>')
            .replace(/<think>/gi, '<thinking>')
            .replace(/<\/think>/gi, '</thinking>')
            .replace(/<\|startofthinking\|>/gi, '<thinking>')
            .replace(/<\|endofthinking\|>/gi, '</thinking>');

          let i = 0;
          while (i < normalizedContent.length) {
            const remaining = normalizedContent.slice(i);

            const openMatch = remaining.match(/^<\|?(?:thinking|think)>/i);
            if (openMatch) {
              inThinking = true;
              i += openMatch[0].length;
              console.log('[THINKING DEBUG] Opened thinking tag');
              continue;
            }

            const closeMatch = remaining.match(/^<\|?\/(?:thinking|think)>/i);
            if (closeMatch) {
              inThinking = false;
              i += closeMatch[0].length;
              console.log('[THINKING DEBUG] Closed thinking tag');
              continue;
            }

            const char = normalizedContent[i];
            if (inThinking) {
              accumulatedThinking += char;
            } else {
              accumulatedContent += char;
            }
            i++;
          }

          // Update the streaming message
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[streamingMessageIndex] = {
              role: 'assistant',
              content: accumulatedContent,
              thinking: accumulatedThinking,
              isStreaming: !chunk.done
            };
            return newMessages;
          });
        }

        if (chunk.reasoning) {
          accumulatedThinking += String(chunk.reasoning);
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[streamingMessageIndex] = {
              role: 'assistant',
              content: accumulatedContent,
              thinking: accumulatedThinking,
              isStreaming: !chunk.done
            };
            return newMessages;
          });
        }

        if (chunk.done) {
          console.log('[InlineChat] Stream complete');
          break;
        }
      }

      // Log final accumulated data
      console.log('[InlineChat] Stream finished. Final data:', {
        contentLength: accumulatedContent.length,
        thinkingLength: accumulatedThinking.length,
        hasThinking: accumulatedThinking.length > 0,
        thinkingPreview: accumulatedThinking.substring(0, 200)
      });

      // Mark streaming as complete and collapse thinking
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[streamingMessageIndex] = {
          role: 'assistant',
          content: accumulatedContent || 'No response received',
          thinking: accumulatedThinking,
          isStreaming: false
        };
        return newMessages;
      });

    } catch (err) {
      console.error('[InlineChat] Error sending message:', err);
      let errorMessage = 'Failed to send message';

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // Add helpful context if no response was received
      if (accumulatedContent.length === 0) {
        // If the error message doesn't already explain the issue, add context
        if (!errorMessage.includes('not properly configured') && !errorMessage.includes('not support')) {
          errorMessage = errorMessage || 'No response from model. ';
          errorMessage += ' This could mean: the model is unavailable, your API key is invalid, or the model provider is having issues. Try again or select a different model.';
        }
      }

      setError(errorMessage);
      // Remove the streaming message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 w-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Start a conversation with {modelName}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            // Log if message has thinking
            if (msg.role === 'assistant' && msg.thinking) {
              console.log('[InlineChat] Rendering message with thinking:', {
                messageIndex: idx,
                thinkingLength: msg.thinking.length,
                isStreaming: msg.isStreaming,
                thinkingPreview: msg.thinking.substring(0, 100)
              });
            }

            return (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[70%] ${msg.role === 'assistant' ? 'w-full max-w-full' : ''}`}>
                {msg.role === 'assistant' && msg.thinking && (
                  <ReasoningDisplay reasoning={msg.thinking} isStreaming={msg.isStreaming} className="mb-2" />
                )}
                <Card className={`p-4 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          code: ({node, inline, ...props}) =>
                            inline ? (
                              <code className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                            ) : (
                              <code className="block bg-black/20 dark:bg-white/20 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2" {...props} />
                            ),
                          pre: ({node, ...props}) => <pre className="block bg-black/20 dark:bg-white/20 p-3 rounded-lg overflow-x-auto mb-2" {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-600 dark:text-blue-400 underline hover:opacity-80" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-muted-foreground/50 pl-4 italic mb-2" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2" {...props} />,
                          table: ({node, ...props}) => <table className="border-collapse border border-muted-foreground/30 mb-2" {...props} />,
                          th: ({node, ...props}) => <th className="border border-muted-foreground/30 px-2 py-1 font-bold" {...props} />,
                          td: ({node, ...props}) => <td className="border border-muted-foreground/30 px-2 py-1" {...props} />,
                        }}
                      >
                        {msg.content || (msg.isStreaming ? '...' : '')}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
              </div>
            </div>
            );
          })
        )}
        {loading && messages[messages.length - 1]?.isStreaming !== true && (
          <div className="flex justify-start">
            <Card className="bg-muted p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Connecting...</p>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={`Ask ${modelName} anything...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          size="icon"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
