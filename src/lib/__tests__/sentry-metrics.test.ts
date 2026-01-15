/**
 * Tests for Sentry Metrics Service
 */

import * as Sentry from '@sentry/nextjs';
import { sentryMetrics } from '../sentry-metrics';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  metrics: {
    count: jest.fn(),
    gauge: jest.fn(),
    distribution: jest.fn(),
  },
}));

describe('sentryMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackApiRequest', () => {
    it('should track API request with all metrics', () => {
      sentryMetrics.trackApiRequest('/api/v1/chat', 'POST', 150, 200);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('api.request.count', 1, {
        attributes: {
          endpoint: '/api/v1/chat',
          method: 'POST',
          status_code: '200',
          success: 'true',
        },
      });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'api.request.duration_ms',
        150,
        {
          attributes: {
            endpoint: '/api/v1/chat',
            method: 'POST',
          },
          unit: 'millisecond',
        }
      );
    });

    it('should track errors for 4xx/5xx status codes', () => {
      sentryMetrics.trackApiRequest('/api/v1/chat', 'POST', 100, 500);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('api.request.error', 1, {
        attributes: {
          endpoint: '/api/v1/chat',
          method: 'POST',
          status_code: '500',
          error_type: 'server_error',
        },
      });
    });

    it('should normalize endpoint URLs', () => {
      sentryMetrics.trackApiRequest(
        'https://api.example.com/api/v1/users/12345/messages?page=1',
        'GET',
        100,
        200
      );

      expect(Sentry.metrics.count).toHaveBeenCalledWith('api.request.count', 1, {
        attributes: expect.objectContaining({
          endpoint: '/api/v1/users/:id/messages',
        }),
      });
    });

    it('should normalize UUID paths', () => {
      sentryMetrics.trackApiRequest(
        '/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/messages',
        'GET',
        100,
        200
      );

      expect(Sentry.metrics.count).toHaveBeenCalledWith('api.request.count', 1, {
        attributes: expect.objectContaining({
          endpoint: '/api/v1/sessions/:id/messages',
        }),
      });
    });
  });

  describe('trackApiError', () => {
    it('should track API errors', () => {
      sentryMetrics.trackApiError('/api/v1/chat', 'network');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('api.error.count', 1, {
        attributes: {
          endpoint: '/api/v1/chat',
          error_type: 'network',
        },
      });
    });
  });

  describe('trackChatCompletion', () => {
    it('should track chat completion with all metrics', () => {
      sentryMetrics.trackChatCompletion(
        'gpt-4-turbo',
        'openai',
        100,
        500,
        2000
      );

      expect(Sentry.metrics.count).toHaveBeenCalledWith('chat.completion.count', 1, {
        attributes: {
          model: 'gpt-4-turbo',
          provider: 'openai',
        },
      });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith('chat.tokens.input', 100, {
        attributes: { model: 'gpt-4-turbo', provider: 'openai' },
        unit: 'none',
      });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith('chat.tokens.output', 500, {
        attributes: { model: 'gpt-4-turbo', provider: 'openai' },
        unit: 'none',
      });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith('chat.tokens.total', 600, {
        attributes: { model: 'gpt-4-turbo', provider: 'openai' },
        unit: 'none',
      });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'chat.completion.duration_ms',
        2000,
        {
          attributes: { model: 'gpt-4-turbo', provider: 'openai' },
          unit: 'millisecond',
        }
      );
    });

    it('should calculate and track tokens per second', () => {
      sentryMetrics.trackChatCompletion('gpt-4', 'openai', 100, 400, 1000);

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'chat.throughput.tokens_per_second',
        500, // (100 + 400) / 1000 * 1000
        expect.objectContaining({
          attributes: expect.objectContaining({ model: 'gpt-4' }),
        })
      );
    });

    it('should track model usage', () => {
      sentryMetrics.trackChatCompletion('claude-3-opus', 'anthropic', 50, 200, 1500);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('chat.model_used', 1, {
        attributes: { model: 'claude-3-opus', provider: 'anthropic' },
      });
    });
  });

  describe('trackChatError', () => {
    it('should track chat errors', () => {
      sentryMetrics.trackChatError('gpt-4', 'openai', 'timeout');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('chat.error.count', 1, {
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          error_type: 'timeout',
        },
      });
    });
  });

  describe('trackChatStreaming', () => {
    it('should track streaming metrics', () => {
      sentryMetrics.trackChatStreaming('gpt-4-turbo', 'openai', 200, 5000, 150);

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'chat.streaming.ttft_ms',
        200,
        {
          attributes: { model: 'gpt-4-turbo', provider: 'openai' },
          unit: 'millisecond',
        }
      );

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'chat.streaming.duration_ms',
        5000,
        {
          attributes: { model: 'gpt-4-turbo', provider: 'openai' },
          unit: 'millisecond',
        }
      );

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'chat.streaming.tokens',
        150,
        {
          attributes: { model: 'gpt-4-turbo', provider: 'openai' },
          unit: 'none',
        }
      );
    });
  });

  describe('trackProviderHealth', () => {
    it('should track provider health score', () => {
      sentryMetrics.trackProviderHealth('openai', 95, 'healthy');

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.health.score', 95, {
        attributes: { provider: 'openai', status: 'healthy' },
        unit: 'none',
      });

      expect(Sentry.metrics.count).toHaveBeenCalledWith(
        'provider.health.status_check',
        1,
        {
          attributes: { provider: 'openai', status: 'healthy' },
        }
      );
    });
  });

  describe('trackProviderLatency', () => {
    it('should track all latency percentiles', () => {
      sentryMetrics.trackProviderLatency('openai', 'gpt-4', 150, 120, 300, 500);

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.latency.avg_ms', 150, {
        attributes: { provider: 'openai', model: 'gpt-4' },
        unit: 'millisecond',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.latency.p50_ms', 120, {
        attributes: { provider: 'openai', model: 'gpt-4' },
        unit: 'millisecond',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.latency.p95_ms', 300, {
        attributes: { provider: 'openai', model: 'gpt-4' },
        unit: 'millisecond',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.latency.p99_ms', 500, {
        attributes: { provider: 'openai', model: 'gpt-4' },
        unit: 'millisecond',
      });
    });

    it('should handle undefined percentiles', () => {
      sentryMetrics.trackProviderLatency('openai', 'gpt-4', 150);

      expect(Sentry.metrics.gauge).toHaveBeenCalledTimes(1);
      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.latency.avg_ms', 150, {
        attributes: { provider: 'openai', model: 'gpt-4' },
        unit: 'millisecond',
      });
    });
  });

  describe('trackProviderErrorRate', () => {
    it('should track error rate metrics', () => {
      sentryMetrics.trackProviderErrorRate('openai', 0.05, 1000, 50);

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.error_rate', 5, {
        attributes: { provider: 'openai' },
        unit: 'percent',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.requests.total', 1000, {
        attributes: { provider: 'openai' },
        unit: 'none',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('provider.errors.total', 50, {
        attributes: { provider: 'openai' },
        unit: 'none',
      });
    });
  });

  describe('trackUserAction', () => {
    it('should track user actions', () => {
      sentryMetrics.trackUserAction('send_message', { tier: 'pro' });

      expect(Sentry.metrics.count).toHaveBeenCalledWith('user.action', 1, {
        attributes: {
          action: 'send_message',
          tier: 'pro',
        },
      });
    });
  });

  describe('trackActiveUser', () => {
    it('should track active users', () => {
      sentryMetrics.trackActiveUser('user_hash_123', { tier: 'basic' });

      expect(Sentry.metrics.count).toHaveBeenCalledWith('user.active', 1, {
        attributes: { user_id: 'user_hash_123', tier: 'basic' },
      });
    });
  });

  describe('trackSessionDuration', () => {
    it('should track session duration', () => {
      sentryMetrics.trackSessionDuration(3600, { tier: 'pro' });

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        'user.session.duration_seconds',
        3600,
        {
          attributes: { tier: 'pro' },
          unit: 'second',
        }
      );
    });
  });

  describe('trackUserTier', () => {
    it('should track user tier counts', () => {
      sentryMetrics.trackUserTier('pro', 'active');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('user.tier.count', 1, {
        attributes: { tier: 'pro', status: 'active' },
      });
    });
  });

  describe('trackPageLoad', () => {
    it('should track page load metrics', () => {
      sentryMetrics.trackPageLoad('chat', 1500);

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith('page.load_time_ms', 1500, {
        attributes: { page: 'chat' },
        unit: 'millisecond',
      });

      expect(Sentry.metrics.count).toHaveBeenCalledWith('page.load.count', 1, {
        attributes: { page: 'chat' },
      });
    });
  });

  describe('trackClientError', () => {
    it('should track client errors', () => {
      sentryMetrics.trackClientError('TypeError', 'ChatComponent');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('client.error.count', 1, {
        attributes: {
          error_type: 'TypeError',
          source: 'ChatComponent',
        },
      });
    });
  });

  describe('trackFeatureUsage', () => {
    it('should track feature usage', () => {
      sentryMetrics.trackFeatureUsage('model_selector', 'open');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('feature.usage', 1, {
        attributes: {
          feature: 'model_selector',
          action: 'open',
        },
      });
    });
  });

  describe('trackModelSelection', () => {
    it('should track model selection', () => {
      sentryMetrics.trackModelSelection('gpt-4-turbo', 'openai', 'search');

      expect(Sentry.metrics.count).toHaveBeenCalledWith('model.selection', 1, {
        attributes: { model: 'gpt-4-turbo', provider: 'openai', source: 'search' },
      });
    });
  });

  describe('trackCacheAccess', () => {
    it('should track cache hits', () => {
      sentryMetrics.trackCacheAccess('models', true);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('cache.access', 1, {
        attributes: {
          cache: 'models',
          result: 'hit',
        },
      });
    });

    it('should track cache misses', () => {
      sentryMetrics.trackCacheAccess('models', false);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('cache.access', 1, {
        attributes: {
          cache: 'models',
          result: 'miss',
        },
      });
    });
  });

  describe('trackCacheSize', () => {
    it('should track cache size', () => {
      sentryMetrics.trackCacheSize('messages', 100, 50000);

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('cache.items', 100, {
        attributes: { cache: 'messages' },
        unit: 'none',
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('cache.size_bytes', 50000, {
        attributes: { cache: 'messages' },
        unit: 'byte',
      });
    });
  });

  describe('trackCircuitBreakerState', () => {
    it('should track circuit breaker state changes', () => {
      sentryMetrics.trackCircuitBreakerState('openai', 'gpt-4', 'OPEN', 5);

      expect(Sentry.metrics.count).toHaveBeenCalledWith('circuit_breaker.state_change', 1, {
        attributes: { provider: 'openai', model: 'gpt-4', state: 'OPEN' },
      });

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith('circuit_breaker.failures', 5, {
        attributes: { provider: 'openai', model: 'gpt-4', state: 'OPEN' },
        unit: 'none',
      });
    });
  });
});
