"use client";

import { useEffect, useRef } from "react";
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
  messages: ChatMessageData[];
  isLoading: boolean;
}

export function MessageList({ sessionId, messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.isStreaming]);

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

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {messages.map((msg, idx) => (
        <ChatMessageBubble
          key={msg.id ?? `${msg.role}-${idx}`}
          role={msg.role}
          content={msg.content}
          reasoning={msg.reasoning}
          image={msg.image}
          video={msg.video}
          audio={msg.audio}
          isStreaming={msg.isStreaming}
          model={msg.model}
          showActions={msg.role === 'assistant'}
          onCopy={() => navigator.clipboard.writeText(getTextFromContent(msg.content))}
        />
      ))}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
