'use client';

/**
 * useChatInput Hook
 *
 * Manages chat input state:
 * - Message text
 * - File attachments
 * - Validation
 * - Submit state
 */

import { useState, useCallback, useMemo } from 'react';
import { UseChatInputReturn, ChatInputState, MessageAttachment } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_MESSAGE_LENGTH = 100_000; // 100k characters
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

// =============================================================================
// HOOK
// =============================================================================

interface UseChatInputOptions {
  maxLength?: number;
  maxAttachments?: number;
  onValidationError?: (error: string) => void;
}

export function useChatInput(options: UseChatInputOptions = {}): UseChatInputReturn {
  const {
    maxLength = MAX_MESSAGE_LENGTH,
    maxAttachments = MAX_ATTACHMENTS,
    onValidationError,
  } = options;

  // State
  const [inputState, setInputState] = useState<ChatInputState>({
    message: '',
    attachments: [],
    isSubmitting: false,
    error: null,
  });

  // ===========================================================================
  // COMPUTED
  // ===========================================================================

  const canSubmit = useMemo(() => {
    const { message, attachments, isSubmitting, error } = inputState;

    if (isSubmitting) return false;
    if (error) return false;

    // Must have either message or attachments
    const hasContent = message.trim().length > 0 || attachments.length > 0;
    if (!hasContent) return false;

    // Check message length
    if (message.length > maxLength) return false;

    // Check attachment count
    if (attachments.length > maxAttachments) return false;

    return true;
  }, [inputState, maxLength, maxAttachments]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const setMessage = useCallback((message: string): void => {
    setInputState(prev => ({
      ...prev,
      message,
      error: message.length > maxLength
        ? `Message too long (${message.length}/${maxLength} characters)`
        : null,
    }));
  }, [maxLength]);

  const addAttachment = useCallback((attachment: MessageAttachment): void => {
    setInputState(prev => {
      if (prev.attachments.length >= maxAttachments) {
        const error = `Maximum ${maxAttachments} attachments allowed`;
        onValidationError?.(error);
        return { ...prev, error };
      }

      if (attachment.size && attachment.size > MAX_ATTACHMENT_SIZE) {
        const error = `File too large (max ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`;
        onValidationError?.(error);
        return { ...prev, error };
      }

      return {
        ...prev,
        attachments: [...prev.attachments, attachment],
        error: null,
      };
    });
  }, [maxAttachments, onValidationError]);

  const removeAttachment = useCallback((index: number): void => {
    setInputState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
      error: null,
    }));
  }, []);

  const clearInput = useCallback((): void => {
    setInputState({
      message: '',
      attachments: [],
      isSubmitting: false,
      error: null,
    });
  }, []);

  const setError = useCallback((error: string | null): void => {
    setInputState(prev => ({ ...prev, error }));
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean): void => {
    setInputState(prev => ({ ...prev, isSubmitting }));
  }, []);

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  const validate = useCallback((): boolean => {
    const { message, attachments } = inputState;

    // Check for content
    if (message.trim().length === 0 && attachments.length === 0) {
      const error = 'Please enter a message or add an attachment';
      setInputState(prev => ({ ...prev, error }));
      onValidationError?.(error);
      return false;
    }

    // Check message length
    if (message.length > maxLength) {
      const error = `Message too long (${message.length}/${maxLength} characters)`;
      setInputState(prev => ({ ...prev, error }));
      onValidationError?.(error);
      return false;
    }

    // Check attachments
    if (attachments.length > maxAttachments) {
      const error = `Too many attachments (max ${maxAttachments})`;
      setInputState(prev => ({ ...prev, error }));
      onValidationError?.(error);
      return false;
    }

    // Clear any existing error
    setInputState(prev => ({ ...prev, error: null }));
    return true;
  }, [inputState, maxLength, maxAttachments, onValidationError]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    inputState,
    setMessage,
    addAttachment,
    removeAttachment,
    clearInput,
    setError,
    canSubmit,
    validate,
  };
}
