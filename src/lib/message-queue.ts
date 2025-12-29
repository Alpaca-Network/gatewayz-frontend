/**
 * Message queue implementation to prevent race conditions in message sending
 * Enhanced with offline support and storage persistence for reliability
 * with safe storage fallback
 */

import { networkMonitor } from './network-utils';
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage';

export interface QueuedMessage {
  id: string;
  message: string;
  model: string | null;
  image?: string | null;
  video?: string | null;
  audio?: string | null;
  timestamp: number;
  attempts: number;
  lastAttempt?: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
}

const STORAGE_KEY = 'gatewayz_message_queue';
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 32000]; // Exponential backoff in ms

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private processingPromise: Promise<void> | null = null;
  private onProcess: ((msg: QueuedMessage) => Promise<void>) | null = null;
  private onError: ((msg: QueuedMessage, error: Error) => void) | null = null;
  private onStatusChange: ((msg: QueuedMessage) => void) | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(
    onProcess?: (msg: QueuedMessage) => Promise<void>,
    onError?: (msg: QueuedMessage, error: Error) => void
  ) {
    this.onProcess = onProcess || null;
    this.onError = onError || null;

    // Load persisted queue from storage
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      this.setupNetworkListener();
    }
  }

  /**
   * Load queue from storage for persistence across page reloads
   */
  private loadFromStorage(): void {
    try {
      const stored = safeLocalStorageGet(STORAGE_KEY);
      if (stored) {
        const parsedQueue = JSON.parse(stored) as QueuedMessage[];
        // Reset any "processing" messages to "pending" (they were interrupted)
        this.queue = parsedQueue.map(msg => ({
          ...msg,
          status: msg.status === 'processing' ? 'pending' : msg.status,
        }));
        this.saveToStorage();
        console.log('[MessageQueue] Loaded', this.queue.length, 'messages from storage');
      }
    } catch (error) {
      console.error('[MessageQueue] Failed to load from storage:', error);
    }
  }

  /**
   * Save queue to storage
   */
  private saveToStorage(): void {
    try {
      // Only persist pending and failed messages (not sent ones)
      const toSave = this.queue.filter(msg => msg.status !== 'sent');
      safeLocalStorageSet(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('[MessageQueue] Failed to save to storage:', error);
    }
  }

  /**
   * Setup listener for network status changes
   */
  private setupNetworkListener(): void {
    this.networkUnsubscribe = networkMonitor.subscribe((isOnline) => {
      if (isOnline && this.hasPendingMessages()) {
        console.log('[MessageQueue] Network restored, resuming queue processing...');
        this.startProcessing();
      }
    });
  }

  /**
   * Check if there are pending messages
   */
  hasPendingMessages(): boolean {
    return this.queue.some(msg => msg.status === 'pending');
  }

  /**
   * Get pending message count (for UI indicators)
   */
  getPendingCount(): number {
    return this.queue.filter(msg => msg.status === 'pending').length;
  }

  /**
   * Get failed message count
   */
  getFailedCount(): number {
    return this.queue.filter(msg => msg.status === 'failed').length;
  }

  /**
   * Retry all failed messages
   */
  retryFailed(): void {
    this.queue = this.queue.map(msg =>
      msg.status === 'failed'
        ? { ...msg, status: 'pending' as const, attempts: 0, error: undefined }
        : msg
    );
    this.saveToStorage();
    this.startProcessing();
  }

  /**
   * Set callback for status changes (for UI updates)
   */
  setStatusChangeHandler(handler: (msg: QueuedMessage) => void): void {
    this.onStatusChange = handler;
  }

  /**
   * Notify status change
   */
  private notifyStatusChange(msg: QueuedMessage): void {
    if (this.onStatusChange) {
      this.onStatusChange(msg);
    }
  }

  /**
   * Add a message to the queue
   */
  enqueue(
    message: string,
    model: string | null,
    attachments?: {
      image?: string | null;
      video?: string | null;
      audio?: string | null;
    }
  ): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedMessage: QueuedMessage = {
      id,
      message,
      model,
      image: attachments?.image,
      video: attachments?.video,
      audio: attachments?.audio,
      timestamp: Date.now(),
      attempts: 0,
      status: 'pending'
    };

    this.queue.push(queuedMessage);
    this.saveToStorage();
    this.notifyStatusChange(queuedMessage);
    console.log('[MessageQueue] Message enqueued:', id, message.substring(0, 50));

    // Check network status before processing
    if (!networkMonitor.isOnline) {
      console.log('[MessageQueue] Offline - message queued for later delivery');
      return id;
    }

    // Start processing if not already processing
    if (!this.processing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Remove a message from the queue
   */
  dequeue(id: string): boolean {
    const index = this.queue.findIndex(msg => msg.id === id);
    if (index !== -1 && this.queue[index].status === 'pending') {
      this.queue.splice(index, 1);
      console.log('[MessageQueue] Message dequeued:', id);
      return true;
    }
    return false;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter(m => m.status === 'pending').length,
      processing: this.queue.filter(m => m.status === 'processing').length,
      sent: this.queue.filter(m => m.status === 'sent').length,
      failed: this.queue.filter(m => m.status === 'failed').length
    };
  }

  /**
   * Get a specific message by ID
   */
  getMessage(id: string): QueuedMessage | undefined {
    return this.queue.find(msg => msg.id === id);
  }

  /**
   * Clear sent messages from the queue
   */
  clearSent(): void {
    this.queue = this.queue.filter(msg => msg.status !== 'sent');
  }

  /**
   * Clear all messages
   */
  clearAll(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.queue = [];
    this.processing = false;
    this.processingPromise = null;
    this.saveToStorage();
  }

  /**
   * Cleanup resources (call when unmounting)
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Check if a message with the same content exists in pending state
   */
  hasDuplicatePending(message: string): boolean {
    return this.queue.some(
      msg => msg.status === 'pending' && msg.message === message
    );
  }

  /**
   * Check if error is retryable (network errors, timeouts)
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('failed to fetch') ||
      message.includes('503') ||
      message.includes('504') ||
      error.name === 'TypeError' ||
      error.name === 'AbortError'
    );
  }

  /**
   * Get retry delay based on attempt number
   */
  private getRetryDelay(attempt: number): number {
    const index = Math.min(attempt - 1, RETRY_DELAYS.length - 1);
    const baseDelay = RETRY_DELAYS[index];
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  /**
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing || !this.onProcess) {
      return;
    }

    // Check network status
    if (!networkMonitor.isOnline) {
      console.log('[MessageQueue] Offline - deferring queue processing');
      return;
    }

    this.processing = true;
    console.log('[MessageQueue] Starting queue processing');

    this.processingPromise = (async () => {
      while (this.queue.length > 0) {
        // Check network status before each message
        if (!networkMonitor.isOnline) {
          console.log('[MessageQueue] Connection lost - pausing queue processing');
          break;
        }

        // Find next pending message
        const nextMessage = this.queue.find(msg => msg.status === 'pending');

        if (!nextMessage) {
          break; // No more pending messages
        }

        // Check if we need to wait before retrying (exponential backoff)
        if (nextMessage.lastAttempt && nextMessage.attempts > 0) {
          const delay = this.getRetryDelay(nextMessage.attempts);
          const timeSinceLastAttempt = Date.now() - nextMessage.lastAttempt;
          if (timeSinceLastAttempt < delay) {
            // Schedule retry for later
            const remainingDelay = delay - timeSinceLastAttempt;
            console.log(`[MessageQueue] Waiting ${Math.round(remainingDelay)}ms before retry`);
            await new Promise(resolve => {
              this.retryTimeoutId = setTimeout(resolve, remainingDelay);
            });
            this.retryTimeoutId = null;
            continue;
          }
        }

        nextMessage.status = 'processing';
        nextMessage.attempts++;
        nextMessage.lastAttempt = Date.now();
        this.saveToStorage();
        this.notifyStatusChange(nextMessage);

        console.log('[MessageQueue] Processing message:', nextMessage.id, `(attempt ${nextMessage.attempts}/${MAX_ATTEMPTS})`);

        try {
          await this.onProcess!(nextMessage);
          nextMessage.status = 'sent';
          this.saveToStorage();
          this.notifyStatusChange(nextMessage);
          console.log('[MessageQueue] Message sent successfully:', nextMessage.id);
        } catch (error) {
          const err = error as Error;
          const errorMessage = err.message || 'Unknown error';
          console.error('[MessageQueue] Failed to process message:', nextMessage.id, errorMessage);

          // Check if error is retryable and we have attempts left
          const isRetryable = this.isRetryableError(err);
          const hasAttemptsLeft = nextMessage.attempts < MAX_ATTEMPTS;

          if (isRetryable && hasAttemptsLeft) {
            nextMessage.status = 'pending';
            nextMessage.error = errorMessage;
            this.saveToStorage();
            this.notifyStatusChange(nextMessage);
            console.log(`[MessageQueue] Will retry message in ${this.getRetryDelay(nextMessage.attempts)}ms:`, nextMessage.id);
          } else {
            nextMessage.status = 'failed';
            nextMessage.error = errorMessage;
            this.saveToStorage();
            this.notifyStatusChange(nextMessage);

            if (this.onError) {
              this.onError(nextMessage, err);
            }
            console.error('[MessageQueue] Message failed permanently:', nextMessage.id, errorMessage);
          }
        }
      }

      this.processing = false;
      this.processingPromise = null;
      console.log('[MessageQueue] Queue processing complete');

      // Schedule another cycle if there are pending messages (for retries)
      if (this.hasPendingMessages() && networkMonitor.isOnline) {
        const nextRetryDelay = 5000;
        console.log(`[MessageQueue] Scheduling next processing cycle in ${nextRetryDelay}ms`);
        this.retryTimeoutId = setTimeout(() => {
          this.retryTimeoutId = null;
          this.startProcessing();
        }, nextRetryDelay);
      }
    })();

    return this.processingPromise;
  }

  /**
   * Wait for all messages to be processed
   */
  async waitForCompletion(): Promise<void> {
    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  /**
   * Set the message processor function
   */
  setProcessor(processor: (msg: QueuedMessage) => Promise<void>): void {
    this.onProcess = processor;

    // Start processing if there are pending messages
    if (!this.processing && this.queue.some(m => m.status === 'pending')) {
      this.startProcessing();
    }
  }

  /**
   * Set the error handler function
   */
  setErrorHandler(handler: (msg: QueuedMessage, error: Error) => void): void {
    this.onError = handler;
  }
}