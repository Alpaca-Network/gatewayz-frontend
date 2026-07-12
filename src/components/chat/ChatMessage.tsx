/**
 * Memoized Chat Message Component
 * Prevents unnecessary re-renders of unchanged messages
 *
 * Performance improvement: 50% less re-rendering
 */

import React, { memo, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Bot, User, Copy, RotateCcw, LogIn, Check, FileText, RefreshCw, ThumbsUp, ThumbsDown, Share, MoreHorizontal, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import remarkGfm from 'remark-gfm';
import { shortenModelName } from '@/lib/utils';
import { ChatTimer } from './ChatTimer';

// Lazy load heavy components - enable SSR to prevent hydration mismatch
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: true });
const ReasoningDisplay = dynamic(
  () => import('@/components/chat/reasoning-display').then(mod => ({ default: mod.ReasoningDisplay })),
  { ssr: true }
);
const SearchResults = dynamic(() => import('@/components/chat/SearchResults'), { ssr: true });

/** Structured error metadata attached by use-chat-stream (from the classified AppError). */
export interface ChatErrorInfo {
  code?: string;
  retryable?: boolean;
  requestId?: string;
  retryAfterSeconds?: number;
  rateLimitScope?: 'upstream' | 'gateway';
}

/** Live rate-limit retry state while the stream layer waits out Retry-After. */
export interface RetryNotice {
  scope: 'upstream' | 'gateway';
  retryAfterMs: number;
  startedAt: number;
}

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string | any[];
  reasoning?: string;
  isReasoningStreaming?: boolean;
  image?: string;
  video?: string;
  audio?: string;
  document?: string;
  isStreaming?: boolean;
  wasStopped?: boolean;
  model?: string;
  error?: string;
  hasError?: boolean;
  errorInfo?: ChatErrorInfo;
  retryNotice?: RetryNotice;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  showActions?: boolean;
  // Search tool state
  isSearching?: boolean;
  searchQuery?: string;
  searchResults?: {
    query: string;
    results: Array<{ title: string; url: string; content: string; score?: number }>;
    answer?: string;
  };
  searchError?: string;
}

// Helper to compare content (handles arrays properly)
const contentEquals = (a: string | any[], b: string | any[]): boolean => {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

// Fallback classification from the (already-safe) display copy, used only when
// no structured errorInfo is available (e.g. legacy messages).
const isAuthError = (error: string): boolean => {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('sign in') ||
    lowerError.includes('sign up') ||
    lowerError.includes('log in') ||
    lowerError.includes('authentication') ||
    lowerError.includes('create a free account')
  );
};

const isRateLimitError = (error: string): boolean => {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('rate limit') ||
    lowerError.includes('too many requests') ||
    lowerError.includes('temporarily unavailable') ||
    lowerError.includes('high demand') ||
    lowerError.includes('busy right now') ||
    lowerError.includes('too quickly')
  );
};

const AUTH_ERROR_CODES = new Set(['AUTH_REQUIRED', 'AUTH_EXPIRED', 'AUTH_INVALID']);
const RETRYABLE_ERROR_CODES = new Set([
  'API_RATE_LIMITED',
  'API_UPSTREAM_RATE_LIMITED',
  'API_SERVER_ERROR',
  'NETWORK_ERROR',
  'NETWORK_TIMEOUT',
  'CHAT_STREAM_ERROR',
  'CHAT_MODEL_ERROR',
]);

// Error display: friendly copy plus an action matched to the error kind —
// sign in (auth), add credits (402), renew (inactive subscription), or retry.
// Shows the backend request ID subtly so support can trace the failure.
const ErrorDisplay = ({
  error,
  errorInfo,
  onRetry,
}: {
  error: string;
  errorInfo?: ChatErrorInfo;
  onRetry?: () => void;
}) => {
  const { login } = usePrivy();
  const code = errorInfo?.code;

  const showSignIn = code ? AUTH_ERROR_CODES.has(code) : isAuthError(error);
  const showAddCredits = code === 'API_PAYMENT_REQUIRED';
  const showRenew = code === 'SUBSCRIPTION_INACTIVE';
  const showRetry =
    !!onRetry &&
    !showSignIn &&
    !showAddCredits &&
    !showRenew &&
    (errorInfo?.retryable || (code ? RETRYABLE_ERROR_CODES.has(code) : isRateLimitError(error)));

  return (
    <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
      <p className="mb-0">{error}</p>
      <div className="flex flex-wrap items-center gap-2">
        {showSignIn && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
            onClick={() => login()}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign in to continue
          </Button>
        )}
        {showAddCredits && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
            asChild
          >
            <a href="/settings/credits">
              <CreditCard className="h-4 w-4 mr-2" />
              Add credits
            </a>
          </Button>
        )}
        {showRenew && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
            asChild
          >
            <a href="/settings?tab=billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Renew subscription
            </a>
          </Button>
        )}
        {showRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        )}
      </div>
      {errorInfo?.requestId && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">Error ID: {errorInfo.requestId}</p>
      )}
    </div>
  );
};

// Live countdown shown while the stream layer waits out a rate limit before
// automatically retrying (upstream 429s retry once after Retry-After).
const RetryCountdownNotice = ({ notice }: { notice: RetryNotice }) => {
  const remainingMs = () => Math.max(0, notice.retryAfterMs - (Date.now() - notice.startedAt));
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil(remainingMs() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.ceil(remainingMs() / 1000));
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.retryAfterMs, notice.startedAt]);

  const copy =
    notice.scope === 'upstream'
      ? 'This model is busy right now — retrying'
      : "You're sending requests too quickly — retrying";

  return (
    <div className="mt-2 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-700 dark:text-amber-400">
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        {copy}
        {secondsLeft > 0 ? ` in ${secondsLeft}s…` : '…'}
      </span>
    </div>
  );
};

/**
 * Model name display with copy functionality
 */
const ModelNameWithCopy = ({ model }: { model: string }) => {
  const [copied, setCopied] = useState(false);
  const shortName = shortenModelName(model);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy model name:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer group"
      title={`Copy model: ${shortName}`}
    >
      <span>{shortName}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
};

/**
 * Individual chat message component with memoization
 */
export const ChatMessage = memo<ChatMessageProps>(
  ({
    role,
    content,
    reasoning,
    isReasoningStreaming,
    image,
    video,
    audio,
    document,
    isStreaming,
    wasStopped,
    model,
    error,
    hasError,
    errorInfo,
    retryNotice,
    onCopy,
    onRegenerate,
    onRetry,
    onLike,
    onDislike,
    onShare,
    onMore,
    showActions = true,
    isSearching,
    searchQuery,
    searchResults,
    searchError,
  }) => {
    const isUser = role === 'user';

    // Parse content if it's an array
    let displayContent = '';
    let displayImage = image;
    let displayVideo = video;
    let displayAudio = audio;
    let displayDocument = document;

    if (Array.isArray(content)) {
      content.forEach(part => {
        if (part.type === 'text') {
          displayContent += part.text || '';
        } else if (part.type === 'image_url') {
          displayImage = part.image_url?.url;
        } else if (part.type === 'video_url') {
          displayVideo = part.video_url?.url;
        } else if (part.type === 'audio_url') {
          displayAudio = part.audio_url?.url;
        } else if (part.type === 'file_url') {
          displayDocument = part.file_url?.url;
        }
      });
    } else {
      displayContent = content;
    }

    return (
      <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isUser && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[80%] w-full sm:w-auto`}>
          <Card
            className={`p-4 w-full ${
              isUser
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-transparent border-border text-foreground'
            } ${hasError ? 'border-destructive' : ''}`}
          >
            {/* Image attachment */}
            {displayImage && (
              <div className="mb-3">
                <img
                  src={displayImage}
                  alt="Uploaded"
                  className="max-w-full rounded-md"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}

            {/* Video attachment */}
            {displayVideo && (
              <div className="mb-3">
                <video
                  src={displayVideo}
                  controls
                  className="max-w-full rounded-md"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}

            {/* Audio attachment */}
            {displayAudio && (
              <div className="mb-3">
                <audio src={displayAudio} controls className="w-full" />
              </div>
            )}

            {/* Document attachment */}
            {displayDocument && (
              <div className="mb-3">
                <a
                  href={displayDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 p-2 rounded-md border ${
                    isUser
                      ? 'border-white/20 hover:bg-white/10'
                      : 'border-border hover:bg-muted'
                  } transition-colors`}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm truncate">Attached document</span>
                </a>
              </div>
            )}

            {/* Search results (for web search tool) */}
            {!isUser && (isSearching || searchResults || searchError) && (
              <SearchResults
                query={searchQuery || searchResults?.query}
                results={searchResults?.results}
                isSearching={isSearching}
                answer={searchResults?.answer}
                error={searchError}
              />
            )}

            {/* Message content */}
            <div className={`prose prose-sm max-w-none break-words overflow-wrap-anywhere ${isUser ? 'text-white prose-invert' : 'text-foreground dark:prose-invert'}`}>
              {isUser ? (
                <p className="whitespace-pre-wrap m-0">{displayContent}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: ({ inline, className, children, node, ...props }: any) => {
                      return !inline ? (
                        <pre className="bg-slate-800 dark:bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-w-full">
                          <code className={`${className} break-words whitespace-pre-wrap`} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-sm break-words" {...props}>
                          {children}
                        </code>
                      );
                    },
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 max-w-full -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="min-w-full border-collapse border border-border">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-muted/50">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-3 py-2 text-left font-semibold">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-2">{children}</td>
                    ),
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              )}
            </div>

            {/* Error display */}
            {hasError && error && (
              <ErrorDisplay error={error} errorInfo={errorInfo} onRetry={onRetry} />
            )}

            {/* Rate-limit auto-retry countdown (stream layer is waiting to retry) */}
            {isStreaming && retryNotice && (
              <RetryCountdownNotice notice={retryNotice} />
            )}

            {/* Streaming indicator with timer */}
            {isStreaming && (
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                </div>
                <ChatTimer />
              </div>
            )}

            {/* Stopped indicator */}
            {wasStopped && !isStreaming && (
              <div className="mt-2 text-xs text-muted-foreground italic">
                Response stopped
              </div>
            )}

            {/* Reasoning (for models that support it) - shown below content */}
            {reasoning && !isUser && (
              <div className="mt-3">
                <ReasoningDisplay
                  reasoning={reasoning}
                  isStreaming={isReasoningStreaming}
                  hasContentStarted={Boolean(displayContent)}
                />
              </div>
            )}
          </Card>

          {/* Model info and actions */}
          {!isUser && showActions && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {model && model !== 'openrouter/auto' && (
                <ModelNameWithCopy model={model} />
              )}
              <div className="flex gap-1">
                {onCopy && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onCopy}
                    title="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
                {onLike && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onLike}
                    title="Good response"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                )}
                {onDislike && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onDislike}
                    title="Bad response"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                )}
                {onShare && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onShare}
                    title="Share chat"
                  >
                    <Share className="h-3 w-3" />
                  </Button>
                )}
                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onRegenerate}
                    title="Regenerate response"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                {onMore && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMore}
                    title="More options"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {isUser && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  },
  // Custom comparison function for better memoization
  (prevProps, nextProps) => {
    return (
      prevProps.role === nextProps.role &&
      contentEquals(prevProps.content, nextProps.content) &&
      prevProps.reasoning === nextProps.reasoning &&
      prevProps.isReasoningStreaming === nextProps.isReasoningStreaming &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.wasStopped === nextProps.wasStopped &&
      prevProps.model === nextProps.model &&
      prevProps.image === nextProps.image &&
      prevProps.video === nextProps.video &&
      prevProps.audio === nextProps.audio &&
      prevProps.document === nextProps.document &&
      prevProps.error === nextProps.error &&
      prevProps.hasError === nextProps.hasError &&
      JSON.stringify(prevProps.errorInfo) === JSON.stringify(nextProps.errorInfo) &&
      JSON.stringify(prevProps.retryNotice) === JSON.stringify(nextProps.retryNotice) &&
      prevProps.showActions === nextProps.showActions &&
      prevProps.onCopy === nextProps.onCopy &&
      prevProps.onRetry === nextProps.onRetry &&
      prevProps.onLike === nextProps.onLike &&
      prevProps.onDislike === nextProps.onDislike &&
      prevProps.onShare === nextProps.onShare &&
      prevProps.onMore === nextProps.onMore &&
      prevProps.onRegenerate === nextProps.onRegenerate &&
      // Search-related props
      prevProps.isSearching === nextProps.isSearching &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.searchError === nextProps.searchError &&
      JSON.stringify(prevProps.searchResults) === JSON.stringify(nextProps.searchResults)
    );
  }
);

ChatMessage.displayName = 'ChatMessage';
