"use client";

/**
 * Chat Page v2
 *
 * A simplified chat page using the new modular architecture:
 * - useChatOrchestrator for state management
 * - Separate components for sidebar, messages, and input
 * - Error boundaries for graceful error handling
 *
 * This page can be accessed at /chat-v2 for testing.
 * Once validated, it can replace the main /chat page.
 */

import React, { useEffect, useCallback, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Send,
  Menu,
  Bot,
  User,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

// Import hooks
import { useChatOrchestrator, type ChatMessage, type ChatSession } from "@/hooks/chat";
import { ChatErrorBoundaryWrapper } from "@/components/error/chat-error-boundary";
import type { ModelOption } from "@/components/chat/model-select";

// Lazy load heavy components
const ModelSelect = dynamic(
  () => import("@/components/chat/model-select").then((mod) => ({ default: mod.ModelSelect })),
  {
    loading: () => (
      <Button variant="outline" className="w-[250px] justify-between bg-muted/30" disabled>
        <span className="truncate">Loading models...</span>
      </Button>
    ),
    ssr: false,
  }
);

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => <div className="animate-pulse bg-muted/30 h-16 rounded-md" />,
  ssr: false,
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ChatPageV2() {
  return (
    <ChatErrorBoundaryWrapper fallbackTitle="Chat Error">
      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatPageContent />
      </Suspense>
    </ChatErrorBoundaryWrapper>
  );
}

function ChatPageContent() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track selected model option for ModelSelect component
  const [selectedModelOption, setSelectedModelOption] = React.useState<ModelOption | null>(null);

  // Use the orchestrator hook
  const chat = useChatOrchestrator({
    onAuthRequired: () => {
      toast({
        title: "Authentication Required",
        description: "Please log in to use the chat.",
        variant: "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.messages]);

  // Focus input when ready
  useEffect(() => {
    if (chat.isReady) {
      inputRef.current?.focus();
    }
  }, [chat.isReady]);

  // Handle send
  const handleSend = useCallback(async () => {
    const message = chat.input.inputState.message.trim();
    if (!message || chat.streaming.isStreaming) return;

    await chat.sendMessage(message, chat.selectedModel);
  }, [chat]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Show loading state during initialization
  if (chat.isInitializing) {
    return <ChatPageSkeleton />;
  }

  // Show error state
  if (chat.initError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to load chat</h2>
        <p className="text-muted-foreground mb-4">{chat.initError}</p>
        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
        <ChatSidebar
          sessions={chat.sessions}
          onNewChat={() => chat.startNewChat()}
          onSelectSession={(id) => chat.switchSession(id)}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Chats</SheetTitle>
              </SheetHeader>
              <ChatSidebar
                sessions={chat.sessions}
                onNewChat={() => chat.startNewChat()}
                onSelectSession={(id) => chat.switchSession(id)}
              />
            </SheetContent>
          </Sheet>

          {/* Model selector */}
          <div className="flex-1 flex justify-center">
            <ModelSelect
              selectedModel={selectedModelOption}
              onSelectModel={(model) => {
                setSelectedModelOption(model);
                if (model) {
                  chat.setSelectedModel(model.value);
                }
              }}
            />
          </div>

          {/* Placeholder for right side actions */}
          <div className="w-10" />
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {chat.messages.messages.length === 0 ? (
              <EmptyState onSuggestionClick={(msg) => chat.input.setMessage(msg)} />
            ) : (
              chat.messages.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={message.isStreaming}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={chat.input.inputState.message}
                onChange={(e) => chat.input.setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] pr-12 resize-none"
                disabled={chat.streaming.isStreaming}
              />
              <Button
                size="icon"
                className="absolute right-2 bottom-2"
                onClick={handleSend}
                disabled={!chat.input.canSubmit || chat.streaming.isStreaming}
              >
                {chat.streaming.isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {chat.input.inputState.error && (
              <p className="text-sm text-red-500 mt-2">{chat.input.inputState.error}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

interface ChatSidebarProps {
  sessions: {
    sessions: ChatSession[];
    activeSession: ChatSession | null;
    groupedSessions: Array<{ label: string; sessions: ChatSession[] }>;
    isLoading: boolean;
    deleteSession: (id: number) => Promise<void>;
    updateSession: (id: number, updates: { title?: string }) => Promise<void>;
  };
  onNewChat: () => void;
  onSelectSession: (id: number) => void;
}

function ChatSidebar({ sessions, onNewChat, onSelectSession }: ChatSidebarProps) {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = async (id: number) => {
    if (editTitle.trim()) {
      await sessions.updateSession(id, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Chat Button */}
      <div className="p-4">
        <Button onClick={onNewChat} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {sessions.isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sessions.groupedSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No conversations yet
            </p>
          ) : (
            sessions.groupedSessions.map((group) => (
              <div key={group.label} className="mb-4">
                <h3 className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {group.label}
                </h3>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={sessions.activeSession?.id === session.id}
                    isEditing={editingId === session.id}
                    editTitle={editTitle}
                    onSelect={() => onSelectSession(session.id)}
                    onStartEdit={() => handleStartEdit(session)}
                    onSaveEdit={() => handleSaveEdit(session.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onTitleChange={setEditTitle}
                    onDelete={() => sessions.deleteSession(session.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
}

function SessionItem({
  session,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
  onDelete,
}: SessionItemProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Input
          value={editTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
          className="h-8 text-sm"
        />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSaveEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancelEdit}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
        isActive && "bg-muted"
      )}
      onClick={onSelect}
    >
      <span className="flex-1 truncate text-sm">{session.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onStartEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// =============================================================================
// MESSAGE COMPONENT
// =============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-white dark:bg-white/10"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 max-w-[80%] rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-white dark:bg-white/10"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.content ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : isStreaming ? (
              <span className="inline-block w-2 h-4 bg-current animate-pulse" />
            ) : null}
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && message.content && (
          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
        )}

        {/* Error state */}
        {message.error && (
          <p className="text-sm text-red-500 mt-2">{message.error}</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  onSuggestionClick: (message: string) => void;
}

function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const suggestions = [
    "Explain quantum computing in simple terms",
    "Help me write a Python function to sort a list",
    "What are the best practices for React hooks?",
    "Write a haiku about programming",
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <Bot className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Ask me anything! I can help with coding, writing, analysis, and much more.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        {suggestions.map((suggestion, i) => (
          <Button
            key={i}
            variant="outline"
            className="h-auto py-3 px-4 text-left justify-start"
            onClick={() => onSuggestionClick(suggestion)}
          >
            <span className="line-clamp-2">{suggestion}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

function ChatPageSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-center px-4 py-3 border-b">
          <Skeleton className="h-10 w-[250px]" />
        </header>

        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-24 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-[60px] w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
