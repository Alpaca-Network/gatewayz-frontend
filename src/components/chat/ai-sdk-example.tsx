'use client';

/**
 * Example Component: Using AI SDK with Chain-of-Thought Reasoning
 *
 * This component demonstrates how to integrate AI SDK for chain-of-thought
 * reasoning in your chat interface. It shows:
 *
 * 1. Selecting AI SDK models
 * 2. Enabling chain-of-thought for models that support it
 * 3. Streaming reasoning and content in real-time
 * 4. Displaying reasoning using the enhanced ReasoningDisplay component
 *
 * Integration Steps:
 * 1. Copy this pattern into your chat component
 * 2. Use useGatewayRouter() to detect AI SDK models
 * 3. Route requests through the appropriate gateway
 * 4. Display reasoning using ReasoningDisplay component
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ReasoningDisplay } from './reasoning-display';
import { useGatewayRouter } from '@/hooks/useGatewayRouter';
import { getAISDKAvailableModels, streamAISDKChat } from '@/lib/ai-sdk-chat-service';
import { Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  model?: string;
}

/**
 * Example: AI SDK Chat Component
 * Shows how to implement chain-of-thought reasoning
 */
export function AISDKChatExample() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');
  const [currentContent, setCurrentContent] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const gatewayRouter = useGatewayRouter();

  // Get available AI SDK models
  const aiSdkModels = getAISDKAvailableModels();

  // Check if selected model supports thinking
  const supportsThinking = gatewayRouter.supportsThinking(selectedModel);
  const gatewayType = gatewayRouter.getGatewayFor(selectedModel).type;

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      model: selectedModel,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCurrentContent('');
    setCurrentReasoning('');

    try {
      abortRef.current = new AbortController();

      // If using AI SDK, stream through AI SDK endpoint
      if (gatewayType === 'ai-sdk') {
        const contentMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
          reasoning: m.reasoning,
        }));

        let assistantContent = '';
        let assistantReasoning = '';

        for await (const chunk of streamAISDKChat({
          model: selectedModel,
          messages: [...contentMessages, userMessage],
          enableThinking: supportsThinking,
          apiKey: 'your-api-key', // In real app, get from auth context
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

        // Add assistant message to conversation
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: assistantContent,
          reasoning: assistantReasoning || undefined,
          model: selectedModel,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Use existing Gatewayz streaming for non-AI SDK models
        // This is a placeholder - integrate with your existing streamChatResponse
        console.log('Using Gatewayz gateway for model:', selectedModel);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error appropriately
    } finally {
      setLoading(false);
      setCurrentContent('');
      setCurrentReasoning('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Model Selector */}
      <Card className="p-4">
        <label className="block text-sm font-medium mb-2">
          Select Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          {aiSdkModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
              {model.supportsThinking ? ' (with Thinking)' : ''}
            </option>
          ))}
        </select>
        {supportsThinking && (
          <p className="text-sm text-amber-600 mt-2">
            ✓ This model supports chain-of-thought reasoning
          </p>
        )}
      </Card>

      {/* Messages Display */}
      <div className="space-y-4 h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {/* Reasoning Display */}
            {message.reasoning && (
              <ReasoningDisplay
                reasoning={message.reasoning}
                source="ai-sdk"
                isStreaming={false}
              />
            )}

            {/* Content Display */}
            <div
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-8'
                  : 'bg-gray-200 mr-8'
              }`}
            >
              <p className="text-sm font-medium text-gray-600 mb-1">
                {message.role === 'user' ? 'You' : `${message.model || 'Assistant'}`}
              </p>
              <p className="text-sm text-gray-800">{message.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming Message Display */}
        {loading && (currentContent || currentReasoning) && (
          <div className="space-y-2">
            {currentReasoning && (
              <ReasoningDisplay
                reasoning={currentReasoning}
                isStreaming={true}
                source="ai-sdk"
              />
            )}
            {currentContent && (
              <div className="p-3 rounded-lg bg-gray-200 mr-8">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {selectedModel}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {currentContent}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="min-h-24"
          disabled={loading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Thinking...
            </>
          ) : (
            'Send Message'
          )}
        </Button>
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-blue-50">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Select a model with "Thinking" support to see
          the model's reasoning process as it thinks through your question.
          The reasoning appears above the final answer.
        </p>
      </Card>
    </div>
  );
}

/**
 * Integration Points in Your Chat Component:
 *
 * 1. Model Selection:
 *    - Import getAISDKAvailableModels()
 *    - Display as option category in model picker
 *    - Show thinking capability badge
 *
 * 2. Request Routing:
 *    - Use useGatewayRouter().isAISDK(modelId)
 *    - Route to /api/chat/ai-sdk or /v1/chat/completions
 *    - Set enable_thinking: supportsThinking
 *
 * 3. Stream Handling:
 *    - For AI SDK: handle reasoning and content chunks
 *    - For Gatewayz: use existing stream parsing
 *    - Store both in message.reasoning and message.content
 *
 * 4. UI Display:
 *    - Always show ReasoningDisplay if message.reasoning exists
 *    - Pass source="ai-sdk" for AI SDK messages
 *    - Component handles both plain text and structured formats
 *
 * 5. Session Persistence:
 *    - AI SDK messages saved same as Gatewayz messages
 *    - No database schema changes needed
 *    - reasoning field is optional
 */
