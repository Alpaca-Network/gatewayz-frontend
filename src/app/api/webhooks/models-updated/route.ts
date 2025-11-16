import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook secret (should be in environment variables)
const WEBHOOK_SECRET = process.env.MODEL_WEBHOOK_SECRET || 'your-webhook-secret';

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/webhooks/models-updated',
    },
    async (span) => {
      try {
        // Verify webhook signature
        const signature = request.headers.get('x-webhook-signature');
        const body = await request.text();
        
        if (!verifyWebhookSignature(body, signature)) {
          span.setAttribute('error', 'invalid_signature');
          return NextResponse.json(
            { error: 'Invalid webhook signature' },
            { status: 401 }
          );
        }

        const payload = JSON.parse(body);
        const { gateway, event_type, models, timestamp } = payload;

        span.setAttribute('gateway', gateway || 'unknown');
        span.setAttribute('event_type', event_type);
        span.setAttribute('models_count', Array.isArray(models) ? models.length : 0);

        console.log(`[Webhook] Model update received: ${event_type} for ${gateway}`);

        let invalidatedPaths: string[] = [];
        let invalidatedTags: string[] = [];

        // Process different event types
        switch (event_type) {
          case 'models.added':
          case 'models.updated':
          case 'models.removed':
            // Invalidate gateway-specific cache
            const gatewayTag = `models:gateway:${gateway}`;
            revalidateTag(gatewayTag);
            invalidatedTags.push(gatewayTag);
            
            // Invalidate main models pages
            revalidatePath('/models');
            revalidatePath('/');
            invalidatedPaths.push('/models', '/');
            
            // Invalidate search cache
            revalidateTag('models:search');
            invalidatedTags.push('models:search');
            
            // Invalidate rankings if models changed significantly
            if (event_type === 'models.added' || event_type === 'models.removed') {
              revalidateTag('rankings');
              revalidatePath('/rankings');
              invalidatedTags.push('rankings');
              invalidatedPaths.push('/rankings');
            }
            
            // Invalidate specific model detail pages if provided
            if (Array.isArray(models) && models.length > 0) {
              for (const model of models.slice(0, 10)) { // Limit to prevent too many invalidations
                if (model.id || model.name) {
                  const modelId = model.id || model.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                  const modelTag = `model:${modelId}`;
                  revalidateTag(modelTag);
                  invalidatedTags.push(modelTag);
                  
                  revalidatePath(`/models/${modelId}`);
                  invalidatedPaths.push(`/models/${modelId}`);
                }
              }
            }
            break;

          case 'gateway.status_changed':
            // Gateway availability changed
            revalidateTag('models:all');
            revalidateTag('models:search');
            revalidateTag('rankings');
            invalidatedTags.push('models:all', 'models:search', 'rankings');
            
            revalidatePath('/models');
            revalidatePath('/rankings');
            revalidatePath('/');
            invalidatedPaths.push('/models', '/rankings', '/');
            break;

          default:
            console.warn(`[Webhook] Unknown event type: ${event_type}`);
        }

        console.log(`[Webhook] Cache invalidated: tags=[${invalidatedTags.join(', ')}] paths=[${invalidatedPaths.join(', ')}]`);

        // Log the update to analytics
        await logModelUpdate(payload);

        span.setAttribute('invalidated_tags', invalidatedTags.length);
        span.setAttribute('invalidated_paths', invalidatedPaths.length);
        span.setAttribute('status', 'success');

        return NextResponse.json({
          success: true,
          processed: {
            event_type: event_type,
            gateway: gateway,
            models_count: Array.isArray(models) ? models.length : 0,
            invalidated: {
              tags: invalidatedTags,
              paths: invalidatedPaths
            }
          },
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Webhook processing error:', error);

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        Sentry.captureException(error, {
          tags: {
            api_route: '/api/webhooks/models-updated',
            error_type: 'webhook_processing_error'
          }
        });

        return NextResponse.json(
          { 
            error: error instanceof Error ? error.message : 'Webhook processing failed',
            timestamp: Date.now()
          },
          { status: 500 }
        );
      }
    }
  );
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature || !WEBHOOK_SECRET) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Log model updates to analytics
 */
async function logModelUpdate(payload: any): Promise<void> {
  try {
    const { gateway, event_type, models, timestamp } = payload;
    
    // Log to your analytics service
    console.log('[Analytics] Model update logged:', {
      event: 'model_update',
      gateway,
      event_type,
      models_count: Array.isArray(models) ? models.length : 0,
      timestamp: timestamp || Date.now()
    });

    // You could also send to Statsig, PostHog, etc.
    
  } catch (error) {
    console.error('Failed to log model update:', error);
  }
}

// GET endpoint for webhook status
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/models-updated',
    supported_events: [
      'models.added',
      'models.updated', 
      'models.removed',
      'gateway.status_changed'
    ],
    timestamp: Date.now()
  });
}