/**
 * ChatStreamHandler - Manages streaming chat responses with proper error handling
 *
 * This class solves the ReferenceError issue where accumulatedContent was
 * being accessed in error handlers after the variable scope had exited.
 */

export class ChatStreamHandler {
    // State is stored in a class property, always accessible
    public state: {
        isStreaming: boolean;
        accumulatedContent: string;
        accumulatedReasoning: string;
        inThinking: boolean;
        chunkCount: number;
        errors: Array<{ message: string; timestamp: number; context?: any }>;
        pendingTimeouts: Set<NodeJS.Timeout>;
    };

    constructor() {
        this.state = {
            isStreaming: false,
            accumulatedContent: '',
            accumulatedReasoning: '',
            inThinking: false,
            chunkCount: 0,
            errors: [],
            pendingTimeouts: new Set()
        };
    }

    /**
     * Reset state for a new streaming session
     */
    reset(): void {
        this.cleanup(); // Clear any pending timeouts first
        this.state.accumulatedContent = '';
        this.state.accumulatedReasoning = '';
        this.state.inThinking = false;
        this.state.chunkCount = 0;
        this.state.errors = [];
        this.state.isStreaming = true;
    }

    /**
     * Add content chunk
     */
    addContent(content: string): void {
        if (content) {
            this.state.accumulatedContent += content;
        }
    }

    /**
     * Add reasoning chunk
     */
    addReasoning(reasoning: string): void {
        if (reasoning) {
            this.state.accumulatedReasoning += reasoning;
        }
    }

    /**
     * Process content with thinking tag extraction
     */
    processContentWithThinking(content: string): void {
        // Normalize thinking tags
        let normalizedContent = content
            .replace(/\[THINKING\]/gi, '<thinking>')
            .replace(/\[\/THINKING\]/gi, '</thinking>')
            .replace(/<think>/gi, '<thinking>')
            .replace(/<\/redacted_reasoning>/gi, '</thinking>')
            .replace(/<\/think>/gi, '</thinking>')
            .replace(/<\|startofthinking\|>/gi, '<thinking>')
            .replace(/<\|endofthinking\|>/gi, '</thinking>');

        let i = 0;
        while (i < normalizedContent.length) {
            const remaining = normalizedContent.slice(i);

            // Check for opening thinking tag
            const openMatch = remaining.match(/^<\|?(?:thinking|think)>/i);
            if (openMatch) {
                this.state.inThinking = true;
                i += openMatch[0].length;
                continue;
            }

            // Check for closing thinking tag
            const closeMatch = remaining.match(/^<\|?\/(?:thinking|think)>/i);
            if (closeMatch) {
                this.state.inThinking = false;
                i += closeMatch[0].length;
                continue;
            }

            // Add character to appropriate accumulator
            const char = normalizedContent[i];
            if (this.state.inThinking) {
                this.state.accumulatedReasoning += char;
            } else {
                this.state.accumulatedContent += char;
            }
            i++;
        }
    }

    /**
     * Register a timeout that can be cleaned up later
     */
    registerTimeout(timeoutId: NodeJS.Timeout): void {
        this.state.pendingTimeouts.add(timeoutId);
    }

    /**
     * Clean up pending timeouts
     */
    cleanup(): void {
        this.state.pendingTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.state.pendingTimeouts.clear();
    }

    /**
     * Add error with context
     */
    addError(error: Error | string, context?: any): void {
        const errorMessage = error instanceof Error ? error.message : error;
        this.state.errors.push({
            message: errorMessage,
            timestamp: Date.now(),
            context: {
                ...context,
                // Always capture the accumulated content at time of error
                accumulatedContent: this.state.accumulatedContent,
                accumulatedReasoning: this.state.accumulatedReasoning,
                chunkCount: this.state.chunkCount
            }
        });
    }

    /**
     * Mark streaming as complete
     */
    complete(): void {
        this.state.isStreaming = false;
        this.cleanup(); // Clear any pending timeouts
    }

    /**
     * Get final content
     */
    getFinalContent(): string {
        return this.state.accumulatedContent;
    }

    /**
     * Get final reasoning
     */
    getFinalReasoning(): string {
        return this.state.accumulatedReasoning;
    }

    /**
     * Increment chunk counter
     */
    incrementChunkCount(): void {
        this.state.chunkCount++;
    }

    /**
     * Get error summary for debugging
     */
    getErrorSummary(): string {
        if (this.state.errors.length === 0) {
            return 'No errors';
        }

        const lastError = this.state.errors[this.state.errors.length - 1];
        return `Error: ${lastError.message} (${this.state.errors.length} total errors, ${this.state.chunkCount} chunks received, ${this.state.accumulatedContent.length} chars accumulated)`;
    }
}
