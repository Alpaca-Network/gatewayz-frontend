'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSharedChat, SharedChatPublicView } from '@/lib/share-chat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens?: number;
  created_at: string;
}

export default function SharedChatPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedChat, setSharedChat] = useState<SharedChatPublicView['data'] | null>(null);

  useEffect(() => {
    async function loadSharedChat() {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const result = await getSharedChat(token);

        if (!result.success || !result.data) {
          setError(result.error || 'Failed to load shared chat');
          setLoading(false);
          return;
        }

        setSharedChat(result.data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading shared chat:', err);
        setError('Failed to load shared chat');
        setLoading(false);
      }
    }

    loadSharedChat();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <div className="space-y-4 mt-8">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedChat) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {error === 'Shared chat not found or has expired'
                ? 'Chat Not Found'
                : 'Unable to Load Chat'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {error || 'This shared chat link is invalid or has expired.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="default">
                <Link href="/">Go to Home</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/chat">Start New Chat</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">{sharedChat.title}</h1>
            <Button asChild variant="outline" size="sm">
              <Link href="/chat" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Try Gatewayz
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Model: {sharedChat.model}</span>
            <span>•</span>
            <span>
              {new Date(sharedChat.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-6">
          {sharedChat.messages.map((message: ChatMessage) => (
            <Card
              key={message.id}
              className={`p-6 ${
                message.role === 'user'
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-foreground'
                    }`}
                  >
                    {message.role === 'user' ? 'U' : 'AI'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    {message.model && message.role === 'assistant' && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {message.model}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                  {message.tokens && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {message.tokens.toLocaleString()} tokens
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <h2 className="text-2xl font-bold mb-2">Try Gatewayz</h2>
            <p className="text-muted-foreground mb-6">
              Access 200+ AI models through a single API
            </p>
            <Button asChild size="lg">
              <Link href="/chat">Start Chatting</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
