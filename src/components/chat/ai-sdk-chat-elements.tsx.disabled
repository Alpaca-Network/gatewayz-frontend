"use client";

import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReasoningDisplay } from './reasoning-display';
import { cn } from '@/lib/utils';
import {
  Message,
  MessageContent,
  MessageList,
  MessageAvatar,
  MessageMetadata,
  PromptForm,
  PromptInput,
  PromptSubmit,
  PromptContainer,
  PromptActions,
  PromptLoading,
} from '@/components/ai-sdk-elements';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface AISDKChatElementsProps {
  modelId: string;
  apiKey: string;
  className?: string;
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
  onError?: (error: Error) => void;
  onFinish?: (message: any) => void;
}

/**
 * AI SDK Chat with Elements
 *
 * Premium chat interface using Vercel AI SDK with Elements design patterns.
 *
 * Features:
 * - Streaming responses with AI SDK's useChat hook
 * - Chain-of-thought reasoning display
 * - Composable UI with AI SDK Elements
 * - Automatic message history management
 * - Optimistic UI updates
 * - Error handling with retry
 * - Stop generation capability
 */
export function AISDKChatElements({
  modelId,
  apiKey,
  className,
  initialMessages,
  onError,
  onFinish,
}: AISDKChatElementsProps) {
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
    onError: (err) => {
      console.error('[AI SDK Chat Elements] Error:', err);
      onError?.(err);
    },
    onFinish: (message) => {
      console.log('[AI SDK Chat Elements] Message finished:', {
        role: message.role,
        contentLength: message.content.length,
      });
      onFinish?.(message);
    },
  });

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <MessageList>
            {messages.map((message) => {
              const isLastMessage = message.id === messages[messages.length - 1]?.id;
              const isStreaming = isLoading && isLastMessage;

              return (
                <Message key={message.id} role={message.role as 'user' | 'assistant'}>
                  {/* Avatar */}
                  <MessageAvatar role={message.role as 'user' | 'assistant'} />

                  {/* Message Content Container */}
                  <div className="flex-1 space-y-2">
                    {/* Chain of Thought Reasoning (for assistant with thinking) */}
                    {message.role === 'assistant' && message.experimental_thinking && (
                      <ReasoningDisplay
                        reasoning={message.experimental_thinking}
                        isStreaming={isStreaming}
                        source="ai-sdk"
                      />
                    )}

                    {/* Message Content with Markdown */}
                    <MessageContent
                      role={message.role as 'user' | 'assistant'}
                      markdown={true}
                    >
                      {message.content}
                    </MessageContent>

                    {/* Streaming Indicator */}
                    {isStreaming && (
                      <PromptLoading text="Generating response..." />
                    )}

                    {/* Message Metadata */}
                    {message.createdAt && (
                      <MessageMetadata>
                        <span>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </MessageMetadata>
                    )}
                  </div>
                </Message>
              );
            })}

            {/* Error Display */}
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-sm text-destructive/80 mt-1">{error.message}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reload()}
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </MessageList>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <PromptForm onSubmit={onFormSubmit}>
            <PromptContainer>
              <PromptInput
                value={input}
                onChange={handleInputChange}
                disabled={isLoading}
                onSubmit={() => {
                  if (input.trim() && !isLoading) {
                    handleSubmit();
                  }
                }}
              />
              <PromptActions>
                <PromptSubmit
                  isLoading={isLoading}
                  onStop={stop}
                  disabled={!input.trim() && !isLoading}
                />
              </PromptActions>
            </PromptContainer>
          </PromptForm>
        </div>
      </div>
    </div>
  );
}
