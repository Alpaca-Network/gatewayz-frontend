"use client";

import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, StopCircle } from 'lucide-react';
import { ReasoningDisplay } from './reasoning-display';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';

interface AISDKChatProps {
  modelId: string;
  apiKey: string;
  className?: string;
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * AI SDK Chat Component
 *
 * Uses the official Vercel AI SDK's useChat hook for streaming chat
 * with built-in support for chain-of-thought reasoning and optimistic updates.
 *
 * Features:
 * - Streaming responses with real-time updates
 * - Chain-of-thought reasoning display
 * - Automatic message history management
 * - Optimistic UI updates
 * - Error handling and retry
 */
export function AISDKChat({ modelId, apiKey, className, initialMessages }: AISDKChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
  } = useChat({
    api: '/api/chat/ai-sdk-completions',
    body: {
      model: modelId,
      apiKey,
    },
    initialMessages,
    onError: (error) => {
      console.error('[AI SDK Chat] Error:', error);
    },
    onFinish: (message) => {
      console.log('[AI SDK Chat] Message finished:', {
        role: message.role,
        contentLength: message.content.length,
      });
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 max-w-[80%]",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {/* Reasoning Display (for assistant messages with thinking) */}
                {message.role === 'assistant' && message.experimental_thinking && (
                  <ReasoningDisplay
                    reasoning={message.experimental_thinking}
                    isStreaming={isLoading && message.id === messages[messages.length - 1]?.id}
                    source="ai-sdk"
                    className="mb-3"
                  />
                )}

                {/* Message Content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      // Custom rendering for code blocks
                      code: ({ node, inline, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <pre className={cn("rounded-lg p-4 overflow-x-auto", className)}>
                            <code {...props}>{children}</code>
                          </pre>
                        ) : (
                          <code className={cn("rounded px-1 py-0.5", className)} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>

                {/* Streaming Indicator */}
                {isLoading && message.id === messages[messages.length - 1]?.id && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive font-medium">Error</p>
              <p className="text-sm text-destructive/80 mt-1">{error.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reload()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e as any);
                  }
                }
              }}
            />
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={stop}
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
