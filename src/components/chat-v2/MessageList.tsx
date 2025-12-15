"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChatMessage as ChatMessageBubble } from "@/components/chat/ChatMessage";
import type { ChatMessage as ChatMessageData } from "@/lib/chat-history";

const getTextFromContent = (content: string | any[]): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
  }
  return '';
};

interface MessageListProps {
  sessionId: number | null;
  messages: (ChatMessageData & { error?: string; hasError?: boolean; wasStopped?: boolean })[];
  isLoading: boolean;
  pendingPrompt?: string | null;  // Optimistic message shown while session is being created
  onRetry?: () => void;  // Callback to retry the last failed message
  onRegenerate?: () => void;  // Callback to regenerate the last response
  onLike?: (messageId: number) => void;  // Callback for positive feedback
  onDislike?: (messageId: number) => void;  // Callback for negative feedback
  onShare?: (messageId: number) => void;  // Callback to share a message
}

export function MessageList({ sessionId, messages, isLoading, pendingPrompt, onRetry, onRegenerate, onLike, onDislike, onShare }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const lastMessageCountRef = useRef(messages.length);

  // Detect if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user is near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setUserHasScrolled(!isNearBottom);
  }, []);

  // Get the last message for dependency tracking
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage?.content);

  // Auto-scroll to bottom only when:
  // 1. New message is added (user or assistant)
  // 2. User hasn't manually scrolled away
  // 3. OR when streaming starts (new assistant message)
  // 4. OR during streaming when content updates
  useEffect(() => {
    const isNewMessage = messages.length > lastMessageCountRef.current;
    const isStreamingNewMessage = lastMessage?.isStreaming && isNewMessage;

    // Always scroll on new message or when streaming starts
    if (isNewMessage || isStreamingNewMessage) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUserHasScrolled(false);
    }
    // Scroll during streaming only if user hasn't scrolled away
    else if (lastMessage?.isStreaming && !userHasScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    lastMessageCountRef.current = messages.length;
  }, [messages.length, lastMessage?.isStreaming, lastMessageContent, userHasScrolled]);

  // Show pending prompt as optimistic message while session is being created
  // This MUST come before the sessionId check to show UI immediately
  if (pendingPrompt && messages.length === 0) {
    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6"
      >
        {/* Optimistic user message */}
        <ChatMessageBubble
          role="user"
          content={pendingPrompt}
          showActions={false}
          onCopy={() => navigator.clipboard.writeText(pendingPrompt)}
        />
        {/* Optimistic assistant message (loading) */}
        <ChatMessageBubble
          role="assistant"
          content=""
          isStreaming={true}
          showActions={false}
          onCopy={() => {}}
        />
        <div ref={bottomRef} className="h-1" />
      </div>
    );
  }

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">Start the conversation</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ask a question or pick one of the suggested prompts to begin.
        </p>
      </div>
    );
  }

  // Only show retry button on the last message if it has an error
  const lastMessageIndex = messages.length - 1;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6"
    >
      {messages.map((msg, idx) => {
        const isLastAssistant = msg.role === 'assistant' && idx === lastMessageIndex;
        return (
          <ChatMessageBubble
            key={msg.id ?? `${msg.role}-${idx}`}
            role={msg.role}
            content={msg.content}
            reasoning={msg.reasoning}
            image={msg.image}
            video={msg.video}
            audio={msg.audio}
            document={msg.document}
            isStreaming={msg.isStreaming}
            wasStopped={msg.wasStopped}
            model={msg.model}
            error={msg.error}
            hasError={msg.hasError}
            showActions={msg.role === 'assistant'}
            onCopy={() => navigator.clipboard.writeText(getTextFromContent(msg.content))}
            onRetry={idx === lastMessageIndex && msg.hasError ? onRetry : undefined}
            onRegenerate={isLastAssistant && !msg.isStreaming ? onRegenerate : undefined}
            onLike={msg.role === 'assistant' && msg.id != null && onLike ? () => onLike(msg.id) : undefined}
            onDislike={msg.role === 'assistant' && msg.id != null && onDislike ? () => onDislike(msg.id) : undefined}
            onShare={msg.role === 'assistant' && msg.id != null && onShare ? () => onShare(msg.id) : undefined}
          />
        );
      })}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
