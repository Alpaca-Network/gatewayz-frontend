"use client";

import { ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, StopCircle } from 'lucide-react';

/**
 * AI SDK Elements: Prompt Components
 *
 * Based on Vercel AI SDK Elements design patterns
 * https://ai-sdk.dev/elements
 */

// Prompt Form
export interface PromptFormProps extends ComponentProps<'form'> {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const PromptForm = forwardRef<HTMLFormElement, PromptFormProps>(
  ({ className, children, onSubmit, ...props }, ref) => {
    return (
      <form
        ref={ref}
        onSubmit={onSubmit}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </form>
    );
  }
);

PromptForm.displayName = 'PromptForm';

// Prompt Input
export interface PromptInputProps extends ComponentProps<typeof Textarea> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  ({ className, value, onChange, onSubmit, disabled, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value?.trim() && !disabled && onSubmit) {
          onSubmit();
        }
      }

      // Call original onKeyDown if provided
      props.onKeyDown?.(e);
    };

    return (
      <Textarea
        ref={ref}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn("min-h-[80px] resize-none", className)}
        placeholder="Type your message..."
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

PromptInput.displayName = 'PromptInput';

// Prompt Submit Button
export interface PromptSubmitProps extends ComponentProps<typeof Button> {
  isLoading?: boolean;
  onStop?: () => void;
}

export const PromptSubmit = forwardRef<HTMLButtonElement, PromptSubmitProps>(
  ({ className, isLoading, onStop, children, ...props }, ref) => {
    if (isLoading && onStop) {
      return (
        <Button
          ref={ref}
          type="button"
          size="icon"
          variant="destructive"
          onClick={onStop}
          className={className}
          {...props}
        >
          {children || <StopCircle className="h-4 w-4" />}
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        type="submit"
        size="icon"
        className={className}
        {...props}
      >
        {children || <Send className="h-4 w-4" />}
      </Button>
    );
  }
);

PromptSubmit.displayName = 'PromptSubmit';

// Prompt Container
export interface PromptContainerProps extends ComponentProps<'div'> {}

export const PromptContainer = forwardRef<HTMLDivElement, PromptContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex gap-2 items-start", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PromptContainer.displayName = 'PromptContainer';

// Prompt Actions (for additional buttons)
export interface PromptActionsProps extends ComponentProps<'div'> {}

export const PromptActions = forwardRef<HTMLDivElement, PromptActionsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2 shrink-0", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PromptActions.displayName = 'PromptActions';

// Prompt Loading Indicator
export interface PromptLoadingProps extends ComponentProps<'div'> {
  text?: string;
}

export const PromptLoading = forwardRef<HTMLDivElement, PromptLoadingProps>(
  ({ className, text = 'Thinking...', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
        {...props}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{text}</span>
      </div>
    );
  }
);

PromptLoading.displayName = 'PromptLoading';
