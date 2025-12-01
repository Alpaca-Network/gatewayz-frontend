"use client";

import { ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * AI SDK Elements: Message Components
 *
 * Based on Vercel AI SDK Elements design patterns
 * https://ai-sdk.dev/elements
 */

// Message Container
export interface MessageProps extends ComponentProps<'div'> {
  role: 'user' | 'assistant' | 'system';
}

export const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ role, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-role={role}
        className={cn(
          "flex gap-3 w-full",
          role === 'user' && "justify-end",
          role === 'assistant' && "justify-start",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Message.displayName = 'Message';

// Message Content
export interface MessageContentProps extends ComponentProps<'div'> {
  role: 'user' | 'assistant' | 'system';
  markdown?: boolean;
}

export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ role, markdown = true, className, children, ...props }, ref) => {
    const content = typeof children === 'string' && markdown ? (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: ({ node, inline, className: codeClassName, children: codeChildren, ...codeProps }) => {
              return !inline ? (
                <pre className={cn("rounded-lg p-4 overflow-x-auto bg-muted", codeClassName)}>
                  <code {...codeProps}>{codeChildren}</code>
                </pre>
              ) : (
                <code className={cn("rounded px-1.5 py-0.5 bg-muted", codeClassName)} {...codeProps}>
                  {codeChildren}
                </code>
              );
            },
            a: ({ node, className: linkClassName, children: linkChildren, ...linkProps }) => (
              <a
                className={cn("text-primary hover:underline", linkClassName)}
                target="_blank"
                rel="noopener noreferrer"
                {...linkProps}
              >
                {linkChildren}
              </a>
            ),
          }}
        >
          {children as string}
        </ReactMarkdown>
      </div>
    ) : (
      children
    );

    return (
      <div
        ref={ref}
        data-role={role}
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%]",
          role === 'user' && "bg-primary text-primary-foreground",
          role === 'assistant' && "bg-muted text-foreground",
          role === 'system' && "bg-accent text-accent-foreground",
          className
        )}
        {...props}
      >
        {content}
      </div>
    );
  }
);

MessageContent.displayName = 'MessageContent';

// Message List
export interface MessageListProps extends ComponentProps<'div'> {}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-4 w-full", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MessageList.displayName = 'MessageList';

// Message Avatar
export interface MessageAvatarProps extends ComponentProps<'div'> {
  role: 'user' | 'assistant' | 'system';
}

export const MessageAvatar = forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ role, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-role={role}
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border",
          role === 'user' && "bg-primary text-primary-foreground border-primary",
          role === 'assistant' && "bg-muted text-foreground border-border",
          role === 'system' && "bg-accent text-accent-foreground border-accent",
          className
        )}
        {...props}
      >
        {children || (
          <span className="text-xs font-semibold">
            {role === 'user' ? 'U' : role === 'assistant' ? 'AI' : 'S'}
          </span>
        )}
      </div>
    );
  }
);

MessageAvatar.displayName = 'MessageAvatar';

// Message Metadata
export interface MessageMetadataProps extends ComponentProps<'div'> {}

export const MessageMetadata = forwardRef<HTMLDivElement, MessageMetadataProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 text-xs text-muted-foreground mt-1", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MessageMetadata.displayName = 'MessageMetadata';
