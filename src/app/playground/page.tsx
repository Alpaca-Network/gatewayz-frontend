'use client';

/**
 * AI SDK Playground
 *
 * Interactive playground for testing AI SDK chain-of-thought reasoning
 * - Model selection with thinking capability detection
 * - Real-time streaming with reasoning display
 * - Parameter controls (temperature, max_tokens, etc.)
 * - Message history with reasoning preservation
 * - Side-by-side reasoning and content display
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ReasoningDisplay } from '@/components/chat/reasoning-display';
import { useGatewayRouter } from '@/hooks/useGatewayRouter';
import { getAISDKAvailableModels, streamAISDKChat } from '@/lib/ai-sdk-chat-service';
import { usePrivy } from '@privy-io/react-auth';
import { getApiKey } from '@/lib/api';
import {
  Loader2,
  Send,
  RotateCcw,
  Copy,
  Check,
  Brain,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  model?: string;
  timestamp: Date;
}

export default function PlaygroundPage() {
  const { ready, authenticated } = usePrivy();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(1);
  const [currentContent, setCurrentContent] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const gatewayRouter = useGatewayRouter();

  // Get available models
  const aiSdkModels = getAISDKAvailableModels();

  // Check if model supports thinking
  const supportsThinking = gatewayRouter.supportsThinking(selectedModel);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentContent, currentReasoning]);

  // Get API key from storage
  const getAuthApiKey = useCallback(() => {
    if (ready && authenticated) {
      const apiKey = getApiKey();
      if (!apiKey) {
        toast({
          title: 'Error',
          description: 'API key not found. Please log in again.',
          variant: 'destructive',
        });
        return null;
      }
      return apiKey;
    }
    return null;
  }, [ready, authenticated, toast]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || loading || !ready || !authenticated) return;

    const apiKey = getAuthApiKey();
    if (!apiKey) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      model: selectedModel,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCurrentContent('');
    setCurrentReasoning('');

    try {
      abortRef.current = new AbortController();

      let assistantContent = '';
      let assistantReasoning = '';

      for await (const chunk of streamAISDKChat({
        model: selectedModel,
        messages: [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
            reasoning: m.reasoning,
          })),
          userMessage,
        ],
        enableThinking: supportsThinking,
        apiKey,
        temperature,
        maxTokens,
        topP,
      })) {
        if (abortRef.current?.signal.aborted) break;

        if (chunk.content) {
          assistantContent += chunk.content;
          setCurrentContent(assistantContent);
        }

        if (chunk.reasoning) {
          assistantReasoning += chunk.reasoning;
          setCurrentReasoning(assistantReasoning);
        }

        if (chunk.done) {
          // Message complete
        }
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: assistantContent,
        reasoning: assistantReasoning || undefined,
        model: selectedModel,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred';

      console.error('Error sending message:', error);

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setCurrentContent('');
      setCurrentReasoning('');
    }
  }, [
    input,
    loading,
    ready,
    authenticated,
    messages,
    selectedModel,
    temperature,
    maxTokens,
    topP,
    supportsThinking,
    getAuthApiKey,
    toast,
  ]);

  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setCurrentContent('');
    setCurrentReasoning('');
  }, []);

  const handleCancelMessage = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setLoading(false);
      setCurrentContent('');
      setCurrentReasoning('');
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-6xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="w-8 h-8 text-amber-500" />
                AI SDK Playground
              </h1>
              <p className="text-muted-foreground mt-1">
                Test chain-of-thought reasoning with Claude and other models
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card className="bg-card border-border mb-4">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                    >
                      {aiSdkModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                          {model.supportsThinking ? ' (with Thinking)' : ''}
                        </option>
                      ))}
                    </select>
                    {supportsThinking && (
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Brain className="w-3 h-3" /> Chain-of-thought enabled
                      </p>
                    )}
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <Label>
                      Temperature: <span className="text-amber-400">{temperature.toFixed(2)}</span>
                    </Label>
                    <Slider
                      min={0}
                      max={2}
                      step={0.01}
                      value={[temperature]}
                      onValueChange={(val) => setTemperature(val[0])}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Controls randomness (0=deterministic, 2=creative)</p>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <Label>
                      Max Tokens: <span className="text-amber-400">{maxTokens}</span>
                    </Label>
                    <Slider
                      min={256}
                      max={4096}
                      step={256}
                      value={[maxTokens]}
                      onValueChange={(val) => setMaxTokens(val[0])}
                      className="w-full"
                    />
                  </div>

                  {/* Top P */}
                  <div className="space-y-2">
                    <Label>
                      Top P: <span className="text-amber-400">{topP.toFixed(2)}</span>
                    </Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[topP]}
                      onValueChange={(val) => setTopP(val[0])}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Nucleus sampling (lower = focused, 1 = all tokens)</p>
                  </div>
                </div>

                <Button
                  onClick={handleClearMessages}
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear Messages
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-card rounded-lg p-4 border border-border">
          {messages.length === 0 && !currentContent ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Start a conversation to see chain-of-thought reasoning in action
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {/* Message Content */}
                  <div
                    className={cn(
                      'p-4 rounded-lg max-w-2xl',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground border border-border ml-auto'
                        : 'bg-secondary text-secondary-foreground border border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {message.role === 'user' ? 'You' : message.model || 'Assistant'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === 'assistant' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleCopyMessage(message.id, message.content)
                          }
                          className="flex-shrink-0"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Reasoning Display - below content */}
                    {message.reasoning && (
                      <div className="mt-3">
                        <ReasoningDisplay
                          reasoning={message.reasoning}
                          source="ai-sdk"
                          isStreaming={false}
                          hasContentStarted={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming Message */}
              {loading && (currentContent || currentReasoning) && (
                <div className="space-y-2">
                  <div className="p-4 rounded-lg bg-secondary text-secondary-foreground border border-border max-w-2xl">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {selectedModel}
                    </p>
                    {currentContent ? (
                      <p className="text-sm whitespace-pre-wrap">{currentContent}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Thinking...</p>
                    )}

                    {/* Reasoning Display - below content during streaming */}
                    {currentReasoning && (
                      <div className="mt-3">
                        <ReasoningDisplay
                          reasoning={currentReasoning}
                          isStreaming={!currentContent}
                          hasContentStarted={Boolean(currentContent)}
                          source="ai-sdk"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="space-y-3 border-t border-border pt-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSendMessage();
              }
            }}
            placeholder="Ask anything... (Ctrl+Enter to send)"
            className="min-h-20"
            disabled={loading || !authenticated}
          />

          <div className="flex gap-2 justify-end">
            {loading ? (
              <Button
                onClick={handleCancelMessage}
                variant="destructive"
                className="gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || !authenticated}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            )}
          </div>

          {!authenticated && (
            <p className="text-xs text-muted-foreground">Please log in to use the playground</p>
          )}
        </div>
      </div>
    </div>
  );
}
