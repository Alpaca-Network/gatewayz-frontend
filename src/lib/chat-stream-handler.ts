/**
 * ChatStreamHandler - Manages streaming chat response state
 *
 * This class encapsulates all streaming state to prevent scope issues
 * and ReferenceErrors that can occur when variables are accessed in
 * error handlers but not properly initialized or scoped.
 */

export interface StreamError {
  message: string;
  timestamp: Date;
  partialContent?: string;
}

export interface StreamState {
  isStreaming: boolean;
  accumulatedContent: string;
  accumulatedReasoning: string;
  chunkCount: number;
  errors: StreamError[];
  inThinking: boolean;
}

export interface StreamDiagnostics {
  isStreaming: boolean;
  contentLength: number;
  reasoningLength: number;
  chunkCount: number;
  errorCount: number;
  inThinking: boolean;
  hasContent: boolean;
  hasReasoning: boolean;
  lastError: StreamError | null;
}

export class ChatStreamHandler {
  public state: StreamState;

  constructor() {
    this.state = {
      isStreaming: false,
      accumulatedContent: "",
      accumulatedReasoning: "",
      chunkCount: 0,
      errors: [],
      inThinking: false
    };
  }

  /**
   * Reset the handler state for a new stream
   */
  reset(): void {
    this.state.accumulatedContent = "";
    this.state.accumulatedReasoning = "";
    this.state.chunkCount = 0;
    this.state.errors = [];
    this.state.inThinking = false;
    this.state.isStreaming = false;
  }

  /**
   * Add a content chunk to the accumulated content
   */
  addChunk(content: string): void {
    if (content) {
      this.state.accumulatedContent += content;
      this.state.chunkCount++;
    }
  }

  /**
   * Add a reasoning chunk to the accumulated reasoning
   */
  addReasoning(reasoning: string): void {
    if (reasoning) {
      this.state.accumulatedReasoning += reasoning;
    }
  }

  /**
   * Process a character, handling thinking tags
   */
  addCharacter(char: string): void {
    if (this.state.inThinking) {
      this.state.accumulatedReasoning += char;
    } else {
      this.state.accumulatedContent += char;
    }
  }

  /**
   * Set whether we're currently in a thinking block
   */
  setThinkingMode(inThinking: boolean): void {
    this.state.inThinking = inThinking;
  }

  /**
   * Add an error to the error log with current context
   */
  addError(error: Error | string): void {
    this.state.errors.push({
      message: error instanceof Error ? error.message : error,
      timestamp: new Date(),
      partialContent: this.state.accumulatedContent
    });
  }

  /**
   * Get the accumulated content
   */
  getContent(): string {
    return this.state.accumulatedContent;
  }

  /**
   * Get the accumulated reasoning
   */
  getReasoning(): string {
    return this.state.accumulatedReasoning;
  }

  /**
   * Start streaming
   */
  startStreaming(): void {
    this.state.isStreaming = true;
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    this.state.isStreaming = false;
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.state.isStreaming;
  }

  /**
   * Get diagnostic information about the current stream state
   */
  getDiagnostics(): StreamDiagnostics {
    return {
      isStreaming: this.state.isStreaming,
      contentLength: this.state.accumulatedContent.length,
      reasoningLength: this.state.accumulatedReasoning.length,
      chunkCount: this.state.chunkCount,
      errorCount: this.state.errors.length,
      inThinking: this.state.inThinking,
      hasContent: this.state.accumulatedContent.length > 0,
      hasReasoning: this.state.accumulatedReasoning.length > 0,
      lastError: this.state.errors.length > 0
        ? this.state.errors[this.state.errors.length - 1]
        : null
    };
  }
}
