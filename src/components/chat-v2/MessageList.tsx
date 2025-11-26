"use client";

import { useEffect, useRef } from "react";
import { useSessionMessages } from "@/lib/hooks/use-chat-queries";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { ChatMessage } from "@/components/chat/ChatMessage";

export function MessageList() {
  const { activeSessionId } = useChatUIStore();
  const { data: messages = [], isLoading } = useSessionMessages(activeSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.isStreaming]);

  if (!activeSessionId) {
      return null; // Should show Welcome Screen from parent
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (messages.length === 0) {
      return null; // Empty session, parent can show empty state or just blank
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {messages.map((msg, idx) => (
        <ChatMessage
          key={`${msg.role}-${idx}`}
          role={msg.role}
          content={msg.content}
          reasoning={msg.reasoning}
          image={msg.image}
          video={msg.video}
          audio={msg.audio}
          isStreaming={msg.isStreaming}
          model={msg.model}
          showActions={msg.role === 'assistant'}
          onCopy={() => navigator.clipboard.writeText(msg.content)}
          // onRegenerate implementation omitted for simplicity in v1
        />
      ))}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
