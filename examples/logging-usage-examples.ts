/**
 * Logging Usage Examples
 *
 * This file demonstrates how to use the enhanced logging system
 * across different parts of the application.
 */

import { createLogger, UserImpact } from '@/lib/logger';
import { handleApiError } from '@/app/api/middleware/error-handler';

// ============================================================================
// Example 1: Basic Service Logging
// ============================================================================

const chatLogger = createLogger('ChatService', ['chat', 'service']);

async function sendChatMessage(message: string, modelId: string) {
  chatLogger.info('Sending chat message', {
    messageLength: message.length,
    modelId,
  });

  try {
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ message, modelId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    chatLogger.info('Chat message sent successfully', {
      modelId,
      responseStatus: response.status,
    });

    return response.json();
  } catch (error) {
    chatLogger.error('Failed to send chat message', error as Error, {
      userImpact: UserImpact.HIGH,
      context: {
        messageLength: message.length,
        modelId,
      },
      tags: ['chat-error', 'send-message', `model-${modelId}`],
    });
    throw error;
  }
}

// ============================================================================
// Example 2: API Route Error Handling
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const logger = createLogger('ChatCompletionsAPI', ['api', 'chat']);

  try {
    const body = await request.json();
    const { message, modelId } = body;

    logger.info('Processing chat completion request', {
      modelId,
      messageLength: message?.length,
    });

    // Your API logic here
    const result = await processCompletion(message, modelId);

    logger.info('Chat completion successful', {
      modelId,
      tokensGenerated: result.tokens,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Automatic fingerprinting, user impact, and metadata
    return handleApiError(error, 'Chat Completions API', {
      userImpact: UserImpact.HIGH,
      metadata: {
        endpoint: '/api/chat/completions',
        method: 'POST',
      },
      tags: ['chat-api', 'completion-error'],
    });
  }
}

// ============================================================================
// Example 3: Critical Business Logic
// ============================================================================

const paymentLogger = createLogger('PaymentService', ['payment', 'stripe']);

async function processPayment(amount: number, customerId: string) {
  paymentLogger.info('Processing payment', { amount, customerId });

  try {
    const charge = await stripe.charges.create({
      amount,
      customer: customerId,
      currency: 'usd',
    });

    paymentLogger.info('Payment processed successfully', {
      chargeId: charge.id,
      amount,
      customerId,
    });

    return charge;
  } catch (error) {
    // Critical impact for payment failures
    paymentLogger.error('Payment processing failed', error as Error, {
      userImpact: UserImpact.CRITICAL,
      context: {
        amount,
        customerId,
        currency: 'usd',
      },
      tags: ['payment', 'stripe', 'critical', 'revenue-impact'],
    });
    throw error;
  }
}

// ============================================================================
// Example 4: Background Task with Low Impact
// ============================================================================

const analyticsLogger = createLogger('AnalyticsSync', ['analytics', 'background']);

async function syncAnalyticsData() {
  analyticsLogger.debug('Starting analytics sync');

  try {
    await syncToStatsig();
    analyticsLogger.info('Analytics sync completed');
  } catch (error) {
    // Low impact - user doesn't notice
    analyticsLogger.error('Analytics sync failed', error as Error, {
      userImpact: UserImpact.LOW,
      context: {
        syncType: 'scheduled',
        retryable: true,
      },
      tags: ['analytics', 'background', 'non-blocking'],
    });
    // Don't throw - let app continue
  }
}

// ============================================================================
// Example 5: Authentication Errors
// ============================================================================

const authLogger = createLogger('AuthService', ['auth', 'privy']);

async function authenticateUser(privyToken: string) {
  authLogger.info('Authenticating user');

  try {
    const user = await verifyPrivyToken(privyToken);

    authLogger.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
    });

    return user;
  } catch (error) {
    // High impact - user blocked from app
    authLogger.error('User authentication failed', error as Error, {
      userImpact: UserImpact.HIGH,
      context: {
        authMethod: 'privy',
        tokenPresent: !!privyToken,
      },
      tags: ['auth', 'privy', 'access-blocked'],
    });
    throw error;
  }
}

// ============================================================================
// Example 6: Model API Integration
// ============================================================================

const modelLogger = createLogger('ModelAPI', ['model', 'api', 'openai']);

async function callModelAPI(
  modelId: string,
  prompt: string,
  retryCount: number = 0
) {
  modelLogger.debug('Calling model API', {
    modelId,
    promptLength: prompt.length,
    retryCount,
  });

  try {
    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Model API error: ${response.status}`);
    }

    const data = await response.json();

    modelLogger.info('Model API call successful', {
      modelId,
      tokensUsed: data.usage?.total_tokens,
      retryCount,
    });

    return data;
  } catch (error) {
    // Medium impact - feature works but degraded
    modelLogger.error('Model API call failed', error as Error, {
      userImpact: UserImpact.MEDIUM,
      context: {
        modelId,
        promptLength: prompt.length,
        retryCount,
        maxRetries: 3,
      },
      tags: ['model-api', 'openai', 'retry-eligible'],
    });

    // Retry logic
    if (retryCount < 3) {
      modelLogger.warn('Retrying model API call', {
        modelId,
        retryCount: retryCount + 1,
      });
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callModelAPI(modelId, prompt, retryCount + 1);
    }

    throw error;
  }
}

// ============================================================================
// Example 7: Database Operations
// ============================================================================

const dbLogger = createLogger('Database', ['db', 'postgres']);

async function saveUserSession(userId: string, sessionData: any) {
  dbLogger.debug('Saving user session', { userId });

  try {
    await db.sessions.upsert({
      where: { userId },
      update: sessionData,
      create: { userId, ...sessionData },
    });

    dbLogger.info('User session saved', { userId });
  } catch (error) {
    // Medium-high impact - data not persisted but app works
    dbLogger.error('Failed to save user session', error as Error, {
      userImpact: UserImpact.MEDIUM,
      context: {
        userId,
        operation: 'upsert',
        table: 'sessions',
      },
      tags: ['database', 'session', 'persistence'],
    });
    throw error;
  }
}

// ============================================================================
// Example 8: File Upload
// ============================================================================

const uploadLogger = createLogger('FileUpload', ['upload', 's3']);

async function uploadFile(file: File, userId: string) {
  uploadLogger.info('Starting file upload', {
    fileName: file.name,
    fileSize: file.size,
    userId,
  });

  try {
    const url = await uploadToS3(file, userId);

    uploadLogger.info('File uploaded successfully', {
      fileName: file.name,
      fileSize: file.size,
      userId,
      url,
    });

    return url;
  } catch (error) {
    // Low-medium impact - user can retry
    uploadLogger.error('File upload failed', error as Error, {
      userImpact: UserImpact.LOW,
      context: {
        fileName: file.name,
        fileSize: file.size,
        userId,
        retryable: true,
      },
      tags: ['upload', 's3', 'user-retry-possible'],
    });
    throw error;
  }
}

// ============================================================================
// Example 9: WebSocket Connection
// ============================================================================

const wsLogger = createLogger('WebSocket', ['websocket', 'realtime']);

class ChatWebSocket {
  connect(userId: string) {
    wsLogger.info('Connecting WebSocket', { userId });

    try {
      const ws = new WebSocket(process.env.WS_URL!);

      ws.onopen = () => {
        wsLogger.info('WebSocket connected', { userId });
      };

      ws.onerror = (event) => {
        // Medium impact - chat works but no real-time updates
        wsLogger.error('WebSocket error', new Error('WebSocket connection failed'), {
          userImpact: UserImpact.MEDIUM,
          context: {
            userId,
            readyState: ws.readyState,
          },
          tags: ['websocket', 'connection-error'],
        });
      };

      ws.onclose = () => {
        wsLogger.warn('WebSocket closed', { userId });
      };

      return ws;
    } catch (error) {
      wsLogger.error('WebSocket initialization failed', error as Error, {
        userImpact: UserImpact.MEDIUM,
        context: { userId },
        tags: ['websocket', 'init-error'],
      });
      throw error;
    }
  }
}

// ============================================================================
// Example 10: React Component with ErrorBoundary
// ============================================================================

import { ErrorBoundary } from '@/components/error-boundary';

function ChatPage() {
  return (
    <ErrorBoundary context="ChatPage">
      <ChatInterface />
    </ErrorBoundary>
  );
}

function ChatInterface() {
  // Component that might throw errors
  // All errors automatically logged with fingerprints
  return <div>Chat UI</div>;
}

// ============================================================================
// Example 11: Custom Error Boundary with Fallback
// ============================================================================

function CriticalFeature() {
  return (
    <ErrorBoundary
      context="PaymentForm"
      fallback={
        <div className="error-container">
          <h2>Payment Processing Unavailable</h2>
          <p>Please try again later or contact support.</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      }
    >
      <PaymentForm />
    </ErrorBoundary>
  );
}

// ============================================================================
// Example 12: Conditional Logging Based on Environment
// ============================================================================

import { buildInfo } from '@/lib/build-info';

const devLogger = createLogger('Development', ['dev']);

function debugLog(message: string, data?: any) {
  if (buildInfo.environment === 'development') {
    devLogger.debug(message, data);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function processCompletion(message: string, modelId: string) {
  // Placeholder
  return { tokens: 100, response: 'Hello' };
}

declare const stripe: any;
declare const db: any;
declare function verifyPrivyToken(token: string): Promise<any>;
declare function syncToStatsig(): Promise<void>;
declare function uploadToS3(file: File, userId: string): Promise<string>;

// ============================================================================
// Export for Testing
// ============================================================================

export {
  sendChatMessage,
  processPayment,
  syncAnalyticsData,
  authenticateUser,
  callModelAPI,
  saveUserSession,
  uploadFile,
  ChatWebSocket,
};
