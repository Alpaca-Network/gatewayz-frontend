"use client";

import { useState } from 'react';
import { AISDKChatElements } from '@/components/chat/ai-sdk-chat-elements';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * AI SDK Demo Page
 *
 * Demonstrates the AI SDK integration with Elements UI components
 * and chain-of-thought reasoning support.
 */

const DEMO_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    provider: 'openai',
    supportsThinking: false,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    supportsThinking: false,
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet (with Extended Thinking)',
    provider: 'anthropic',
    supportsThinking: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    supportsThinking: false,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    supportsThinking: false,
  },
  {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto (Fastest)',
    provider: 'openrouter',
    supportsThinking: false,
  },
];

export default function AISDKDemoPage() {
  const { apiKey } = useGatewayzAuth();
  const [selectedModel, setSelectedModel] = useState(DEMO_MODELS[0].id);
  const [chatKey, setChatKey] = useState(0);

  const selectedModelInfo = DEMO_MODELS.find((m) => m.id === selectedModel);

  const resetChat = () => {
    setChatKey((prev) => prev + 1);
  };

  if (!apiKey) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to use the AI SDK demo
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="container max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">AI SDK Demo</h1>
              <p className="text-sm text-muted-foreground">
                Powered by Vercel AI SDK with Elements
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Model Selector */}
              <div className="w-[280px]">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Button */}
              <Button variant="outline" onClick={resetChat}>
                Reset Chat
              </Button>
            </div>
          </div>

          {/* Model Info */}
          {selectedModelInfo && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Provider: <strong>{selectedModelInfo.provider}</strong></span>
              {selectedModelInfo.supportsThinking && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ✨ Supports Chain-of-Thought Reasoning
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <div className="container max-w-4xl mx-auto h-full">
          <AISDKChatElements
            key={chatKey}
            modelId={selectedModel}
            apiKey={apiKey}
            onError={(error) => {
              console.error('Chat error:', error);
            }}
            onFinish={(message) => {
              console.log('Message finished:', message);
            }}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t bg-muted/50 p-2">
        <div className="container max-w-4xl mx-auto">
          <p className="text-xs text-center text-muted-foreground">
            AI SDK v5.0 • Elements UI • Streaming with Chain-of-Thought
          </p>
        </div>
      </div>
    </div>
  );
}
