"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, Send, Edit3, Trash2, Loader2, MessageSquare, Check, Search } from "lucide-react";

import { useChatController } from "./useChatController";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { ModelOption } from "@/components/chat/model-select";

// Helper to extract text from multimodal content
function getTextFromContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('');
  }
  return '';
}

const ModelSelect = dynamic(() => import("@/components/chat/model-select").then((m) => m.ModelSelect), {
  ssr: false,
  loading: () => <div className="h-10 w-[240px] rounded-md bg-muted animate-pulse" />,
});

const DEFAULT_MODEL: ModelOption = {
  value: "fireworks/deepseek-r1",
  label: "DeepSeek R1",
  category: "Reasoning",
  sourceGateway: "fireworks",
  developer: "DeepSeek",
  modalities: ["Text"],
};

export function ChatExperience() {
  const {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    loadingSessions,
    loadingMessages,
    sending,
    error,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    sendMessage,
    clearError,
  } = useChatController();

  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(DEFAULT_MODEL);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  useEffect(() => {
    if (!error) return;
    toast({ title: "Chat error", description: error, variant: "destructive" });
    clearError();
  }, [clearError, error, toast]);

  const activeMessages = useMemo(() => messages, [messages]);

  const handleSend = async (value?: string) => {
    const payload = (value ?? input).trim();
    if (!payload) return;
    await sendMessage(payload, selectedModel, { enableWebSearch: webSearchEnabled });
    setInput("");
  };

  const handleRenameSubmit = async (sessionId: string) => {
    if (!renameValue.trim()) return;
    await renameSession(sessionId, renameValue.trim());
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[70vh]">
      <aside className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-semibold text-sm">Sessions</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => createSession()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[60vh] lg:h-[70vh]">
          <div className="p-2 flex flex-col gap-2">
            {loadingSessions ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-10 rounded-md bg-muted animate-pulse" />
              ))
            ) : sessions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No chats yet. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isRenaming = renamingId === session.id;
                return (
                  <div
                    key={session.id}
                    className={`group rounded-lg border px-3 py-2 transition-colors ${
                      isActive ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
                    }`}
                  >
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleRenameSubmit(session.id);
                            }
                            if (e.key === "Escape") {
                              setRenamingId(null);
                              setRenameValue("");
                            }
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" onClick={() => handleRenameSubmit(session.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          className="text-left flex-1 truncate"
                          onClick={() => selectSession(session.id)}
                        >
                          <p className="text-sm font-medium truncate">{session.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(session.updatedAt).toLocaleString()}
                          </p>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setRenamingId(session.id);
                              setRenameValue(session.title);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSession(session.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      <section className="rounded-xl border bg-card shadow-sm flex flex-col min-h-[70vh]">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{activeSession?.title ?? "New chat"}</Badge>
            {loadingMessages && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Search className={`h-4 w-4 ${webSearchEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <Switch
                      checked={webSearchEnabled}
                      onCheckedChange={setWebSearchEnabled}
                      aria-label="Enable web search"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable web search for current information</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} />
            <Button variant="outline" onClick={() => createSession()}>
              <Plus className="mr-2 h-4 w-4" /> New chat
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
            {activeMessages.length === 0 && !loadingMessages ? (
              <Card>
                <CardContent className="p-6 text-muted-foreground text-sm space-y-2">
                  <p>Ask anything to start the conversation.</p>
                  <div className="flex flex-wrap gap-2">
                    {["What can you do?", "Write a TypeScript function", "Summarize this idea"].map((example) => (
                      <Button
                        key={example}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInput(example);
                          void handleSend(example);
                        }}
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              activeMessages.map((msg, idx) => {
                const isLastAssistant = msg.role === 'assistant' && idx === activeMessages.length - 1;
                return (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                    model={msg.model}
                    isSearching={msg.isSearching}
                    searchQuery={msg.searchQuery}
                    searchResults={msg.searchResults}
                    searchError={msg.searchError}
                    onCopy={() => navigator.clipboard.writeText(getTextFromContent(msg.content))}
                    onLike={msg.role === 'assistant' ? () => console.log('Liked message:', msg.id) : undefined}
                    onDislike={msg.role === 'assistant' ? () => console.log('Disliked message:', msg.id) : undefined}
                    onShare={msg.role === 'assistant' ? () => navigator.clipboard.writeText(getTextFromContent(msg.content)) : undefined}
                    onRegenerate={isLastAssistant && !msg.isStreaming ? () => console.log('Regenerate:', msg.id) : undefined}
                  />
                );
              })
            )}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-3">
          <div className="flex flex-col gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedModel ? `Message ${selectedModel.label}` : "Start a message"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              className="min-h-[96px]"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Enter to send • Shift+Enter for new line
              </p>
              <Button onClick={() => handleSend()} disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
