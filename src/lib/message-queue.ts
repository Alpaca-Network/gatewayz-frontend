/**
 * Message queue implementation to prevent race conditions in message sending
 */

export interface QueuedMessage {
  id: string;
  message: string;
  model: string | null;
  image?: string | null;
  video?: string | null;
  audio?: string | null;
  timestamp: number;
  attempts: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private processingPromise: Promise<void> | null = null;
  private onProcess: ((msg: QueuedMessage) => Promise<void>) | null = null;
  private onError: ((msg: QueuedMessage, error: Error) => void) | null = null;

  constructor(
    onProcess?: (msg: QueuedMessage) => Promise<void>,
    onError?: (msg: QueuedMessage, error: Error) => void
  ) {
    this.onProcess = onProcess || null;
    this.onError = onError || null;
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
    console.log('[MessageQueue] Message enqueued:', id, message.substring(0, 50));

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
    this.queue = [];
    this.processing = false;
    this.processingPromise = null;
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
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing || !this.onProcess) {
      return;
    }

    this.processing = true;
    console.log('[MessageQueue] Starting queue processing');

    this.processingPromise = (async () => {
      while (this.queue.length > 0) {
        // Find next pending message
        const nextMessage = this.queue.find(msg => msg.status === 'pending');

        if (!nextMessage) {
          break; // No more pending messages
        }

        nextMessage.status = 'processing';
        nextMessage.attempts++;

        console.log('[MessageQueue] Processing message:', nextMessage.id);

        try {
          await this.onProcess!(nextMessage);
          nextMessage.status = 'sent';
          console.log('[MessageQueue] Message sent successfully:', nextMessage.id);
        } catch (error) {
          console.error('[MessageQueue] Failed to process message:', nextMessage.id, error);

          // Retry logic
          if (nextMessage.attempts < 3) {
            nextMessage.status = 'pending';
            console.log('[MessageQueue] Will retry message:', nextMessage.id);

            // Add exponential backoff delay
            const delay = Math.pow(2, nextMessage.attempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            nextMessage.status = 'failed';

            if (this.onError) {
              this.onError(nextMessage, error as Error);
            }
          }
        }
      }

      this.processing = false;
      this.processingPromise = null;
      console.log('[MessageQueue] Queue processing complete');
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