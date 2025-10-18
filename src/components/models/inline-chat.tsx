"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { getApiKey, getUserData } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  isStreaming?: boolean;
}

interface InlineChatProps {
  modelId: string;
  modelName: string;
}

export function InlineChat({ modelId, modelName }: InlineChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleThinking = (index: number) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    // Get API key and user data
    const apiKey = getApiKey();
    const userData = getUserData();

    if (!apiKey || !userData?.privy_user_id) {
      setError('Please sign in to use chat');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    // Add a streaming assistant message
    const streamingMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '', isStreaming: true }]);
    setExpandedThinking(prev => new Set(prev).add(streamingMessageIndex));

    try {
      abortControllerRef.current = new AbortController();

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

      console.log('[InlineChat] Sending message to model:', modelId);
      console.log('[InlineChat] Using API endpoint:', `${apiBaseUrl}/v1/chat/completions`);

      const response = await fetch(`${apiBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          stream: true,
          temperature: 0.7
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        console.error('[InlineChat] API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[InlineChat] Error response:', errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      console.log('[InlineChat] Stream started successfully');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let accumulatedThinking = '';
      let inThinking = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.content) {
                  const content = delta.content;

                  // Debug: Log content to see what we're receiving
                  if (content.includes('<thinking') || content.includes('</thinking') || content.includes('[THINKING')) {
                    console.log('[THINKING DEBUG]', { content, inThinking, length: content.length });
                  }

                  // Process content character by character to handle thinking tags correctly
                  let i = 0;
                  while (i < content.length) {
                    // Check for opening thinking tags: <thinking>, <|thinking>
                    if (content.slice(i).match(/^<\|?thinking>/i)) {
                      inThinking = true;
                      const tagMatch = content.slice(i).match(/^<\|?thinking>/i);
                      if (tagMatch) {
                        i += tagMatch[0].length;
                        console.log('[THINKING DEBUG] Opened thinking tag');
                      }
                      continue;
                    }

                    // Check for closing thinking tags: </thinking>, </|thinking>
                    if (content.slice(i).match(/^<\|?\/thinking>/i)) {
                      inThinking = false;
                      const tagMatch = content.slice(i).match(/^<\|?\/thinking>/i);
                      if (tagMatch) {
                        i += tagMatch[0].length;
                        console.log('[THINKING DEBUG] Closed thinking tag');
                      }
                      continue;
                    }

                    // Accumulate content character by character
                    const char = content[i];
                    if (inThinking) {
                      accumulatedThinking += char;
                    } else {
                      accumulatedContent += char;
                    }
                    i++;
                  }

                  // Update the streaming message
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[streamingMessageIndex] = {
                      role: 'assistant',
                      content: accumulatedContent,
                      thinking: accumulatedThinking,
                      isStreaming: true
                    };
                    return newMessages;
                  });
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      // Mark streaming as complete and collapse thinking
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[streamingMessageIndex] = {
          role: 'assistant',
          content: accumulatedContent || 'No response received',
          thinking: accumulatedThinking,
          isStreaming: false
        };
        return newMessages;
      });

      // Collapse thinking after completion
      setExpandedThinking(prev => {
        const newSet = new Set(prev);
        newSet.delete(streamingMessageIndex);
        return newSet;
      });

    } catch (err) {
      console.error('[InlineChat] Error sending message:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request cancelled');
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error - check your connection and try again');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
      // Remove the streaming message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 w-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Start a conversation with {modelName}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[70%] ${msg.role === 'assistant' ? 'w-full max-w-full' : ''}`}>
                {msg.role === 'assistant' && msg.thinking && (
                  <Card className="mb-2 p-3 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <button
                      onClick={() => toggleThinking(idx)}
                      className="flex items-center gap-2 w-full text-left text-sm font-medium text-amber-900 dark:text-amber-100"
                    >
                      {expandedThinking.has(idx) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span>{msg.isStreaming ? 'Thinking...' : 'View thinking process'}</span>
                    </button>
                    {expandedThinking.has(idx) && (
                      <div className="mt-2 text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                        {msg.thinking}
                      </div>
                    )}
                  </Card>
                )}
                <Card className={`p-4 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          code: ({node, inline, ...props}) =>
                            inline ? (
                              <code className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                            ) : (
                              <code className="block bg-black/20 dark:bg-white/20 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2" {...props} />
                            ),
                          pre: ({node, ...props}) => <pre className="block bg-black/20 dark:bg-white/20 p-3 rounded-lg overflow-x-auto mb-2" {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-600 dark:text-blue-400 underline hover:opacity-80" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-muted-foreground/50 pl-4 italic mb-2" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2" {...props} />,
                          table: ({node, ...props}) => <table className="border-collapse border border-muted-foreground/30 mb-2" {...props} />,
                          th: ({node, ...props}) => <th className="border border-muted-foreground/30 px-2 py-1 font-bold" {...props} />,
                          td: ({node, ...props}) => <td className="border border-muted-foreground/30 px-2 py-1" {...props} />,
                        }}
                      >
                        {msg.content || (msg.isStreaming ? '...' : '')}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ))
        )}
        {loading && messages[messages.length - 1]?.isStreaming !== true && (
          <div className="flex justify-start">
            <Card className="bg-muted p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Connecting...</p>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={`Ask ${modelName} anything...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          size="icon"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
