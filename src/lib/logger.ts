/**
 * Enhanced Logging Service
 *
 * Provides structured logging with:
 * - Release SHA and version tracking
 * - Stable error fingerprinting for grouping
 * - Environment and service metadata
 * - User impact tracking
 * - Source map support preparation
 */

// Build-time constants (set via env vars during build)
const RELEASE_SHA = process.env.NEXT_PUBLIC_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
const RELEASE_VERSION = process.env.NEXT_PUBLIC_RELEASE_VERSION || process.env.npm_package_version || '0.1.0';
const SERVICE_NAME = process.env.NEXT_PUBLIC_SERVICE_NAME || 'gatewayz-beta';
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.VERCEL_ENV || 'development';

/**
 * Log levels for filtering and routing
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * User impact severity for error prioritization
 */
export enum UserImpact {
  NONE = 'none',           // Background error, user unaffected
  LOW = 'low',             // Minor UI glitch, functionality works
  MEDIUM = 'medium',       // Feature degraded but usable
  HIGH = 'high',           // Feature broken, workaround exists
  CRITICAL = 'critical',   // Core functionality blocked
}

/**
 * Structured log entry with all metadata
 */
export interface LogEntry {
  // Core message
  level: LogLevel;
  message: string;
  timestamp: string;

  // Service metadata
  service: string;
  environment: string;
  releaseSha: string;
  releaseVersion: string;

  // Error details
  error?: {
    name: string;
    message: string;
    stack?: string;
    fingerprint: string;  // Stable hash for grouping
    code?: string;
  };

  // User context
  user?: {
    id?: string;
    email?: string;
    tier?: string;
    sessionId?: string;
  };

  // Request context
  request?: {
    method?: string;
    url?: string;
    path?: string;
    userAgent?: string;
    referrer?: string;
  };

  // Impact assessment
  userImpact: UserImpact;

  // Custom metadata
  context?: Record<string, any>;
  tags?: string[];

  // Source location
  source?: {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  };
}

/**
 * Simple hash function for browser compatibility
 * Generates a stable hash from a string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to 16 chars
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Double it to get 16 chars for consistency
  return (hex + hex).substring(0, 16);
}

/**
 * Generate a stable fingerprint for error grouping
 * Uses error name, message pattern, and stack trace structure
 */
export function generateErrorFingerprint(error: Error, context?: string): string {
  const parts: string[] = [];

  // Include error name (TypeError, ReferenceError, etc.)
  parts.push(error.name || 'Error');

  // Normalize error message (remove dynamic values)
  const normalizedMessage = normalizeErrorMessage(error.message);
  parts.push(normalizedMessage);

  // Extract stack trace structure (file paths and line numbers removed)
  if (error.stack) {
    const stackStructure = normalizeStackTrace(error.stack);
    parts.push(stackStructure);
  }

  // Include context for additional grouping
  if (context) {
    parts.push(context);
  }

  // Generate stable hash from parts
  const fingerprint = simpleHash(parts.join('::'));

  return fingerprint;
}

/**
 * Normalize error message by removing dynamic values
 * This ensures similar errors group together
 */
function normalizeErrorMessage(message: string): string {
  return message
    // Remove numbers
    .replace(/\d+/g, 'N')
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    // Remove hex strings
    .replace(/0x[0-9a-f]+/gi, 'HEX')
    // Remove file paths
    .replace(/\/[^\s]+\.(ts|js|tsx|jsx)/g, 'FILE')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, 'URL')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract stack trace structure without dynamic values
 */
function normalizeStackTrace(stack: string): string {
  const lines = stack.split('\n')
    .slice(1, 6) // Take first 5 frames
    .map(line => {
      // Extract function name pattern
      const funcMatch = line.match(/at\s+([^\s(]+)/);
      return funcMatch ? funcMatch[1] : 'anonymous';
    })
    .join('|');

  return lines || 'no-stack';
}

/**
 * Parse error stack to extract source location
 */
function parseErrorStack(stack?: string): LogEntry['source'] | undefined {
  if (!stack) return undefined;

  // Match first stack frame: "at Function (file:line:col)"
  const match = stack.match(/at\s+([^\s(]+)\s*\(([^:]+):(\d+):(\d+)\)/);
  if (!match) return undefined;

  return {
    function: match[1],
    file: match[2],
    line: parseInt(match[3], 10),
    column: parseInt(match[4], 10),
  };
}

/**
 * Get current user context from auth state
 */
function getUserContext(): LogEntry['user'] | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const userData = localStorage.getItem('gatewayz_user_data');
    if (!userData) return undefined;

    const parsed = JSON.parse(userData);
    return {
      id: parsed.user_id?.toString(),
      email: parsed.email,
      tier: parsed.tier,
      sessionId: sessionStorage.getItem('session_id') || undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Get request context from current environment
 */
function getRequestContext(): LogEntry['request'] | undefined {
  if (typeof window === 'undefined') return undefined;

  return {
    url: window.location.href,
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    referrer: document.referrer || undefined,
  };
}

/**
 * Create a structured log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  options: {
    error?: Error;
    userImpact?: UserImpact;
    context?: Record<string, any>;
    tags?: string[];
  } = {}
): LogEntry {
  const {
    error,
    userImpact = UserImpact.NONE,
    context,
    tags = [],
  } = options;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    releaseSha: RELEASE_SHA,
    releaseVersion: RELEASE_VERSION,
    userImpact,
    context,
    tags,
  };

  // Add user context
  entry.user = getUserContext();

  // Add request context
  entry.request = getRequestContext();

  // Add error details with fingerprint
  if (error) {
    const contextKey = context?.context || context?.component || 'unknown';
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      fingerprint: generateErrorFingerprint(error, contextKey),
      code: (error as any).code,
    };
    entry.source = parseErrorStack(error.stack);
  }

  return entry;
}

/**
 * Logger class with structured output
 */
export class Logger {
  private context: string;
  private defaultTags: string[];

  constructor(context: string, tags: string[] = []) {
    this.context = context;
    this.defaultTags = tags;
  }

  private log(entry: LogEntry): void {
    // Console output with context prefix
    const prefix = `[${entry.level.toUpperCase()}] [${this.context}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (ENVIRONMENT === 'development') {
          console.debug(prefix, entry.message, entry);
        }
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.context, entry.error);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.error, entry);
        break;
    }

    // Send to external logging service if configured
    this.sendToExternalService(entry);
  }

  private async sendToExternalService(entry: LogEntry): Promise<void> {
    // Only send errors and above to external service
    if (entry.level !== LogLevel.ERROR && entry.level !== LogLevel.FATAL) {
      return;
    }

    try {
      // Send via analytics endpoint (already has auth)
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gatewayz_api_key')}`,
        },
        body: JSON.stringify({
          event_name: 'error_logged',
          metadata: {
            ...entry,
            // Flatten for easier querying
            error_fingerprint: entry.error?.fingerprint,
            error_name: entry.error?.name,
            user_impact: entry.userImpact,
          },
        }),
      }).catch(() => {
        // Silently fail - don't break app on logging errors
      });
    } catch {
      // Silently fail
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    const entry = createLogEntry(LogLevel.DEBUG, message, {
      context: { ...context, context: this.context },
      tags: this.defaultTags,
    });
    this.log(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    const entry = createLogEntry(LogLevel.INFO, message, {
      context: { ...context, context: this.context },
      tags: this.defaultTags,
    });
    this.log(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    const entry = createLogEntry(LogLevel.WARN, message, {
      context: { ...context, context: this.context },
      tags: this.defaultTags,
      userImpact: UserImpact.LOW,
    });
    this.log(entry);
  }

  error(
    message: string,
    error?: Error,
    options: {
      userImpact?: UserImpact;
      context?: Record<string, any>;
      tags?: string[];
    } = {}
  ): void {
    const entry = createLogEntry(LogLevel.ERROR, message, {
      error,
      userImpact: options.userImpact || UserImpact.MEDIUM,
      context: { ...options.context, context: this.context },
      tags: [...this.defaultTags, ...(options.tags || [])],
    });
    this.log(entry);
  }

  fatal(
    message: string,
    error?: Error,
    options: {
      context?: Record<string, any>;
      tags?: string[];
    } = {}
  ): void {
    const entry = createLogEntry(LogLevel.FATAL, message, {
      error,
      userImpact: UserImpact.CRITICAL,
      context: { ...options.context, context: this.context },
      tags: [...this.defaultTags, ...(options.tags || [])],
    });
    this.log(entry);
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string, tags: string[] = []): Logger {
  return new Logger(context, tags);
}

/**
 * Global logger for convenience
 */
export const logger = createLogger('app');

/**
 * Export build metadata for external use
 */
export const buildMetadata = {
  releaseSha: RELEASE_SHA,
  releaseVersion: RELEASE_VERSION,
  serviceName: SERVICE_NAME,
  environment: ENVIRONMENT,
};
