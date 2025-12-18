/**
 * @jest-environment node
 *
 * Isolated tests for error handling in gateways route.
 * These tests use module mocking that would affect other tests,
 * so they're in a separate file.
 */
import { NextRequest } from 'next/server';

// Mock Sentry before importing route
jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

// Mock console methods
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

// Mock fetch
global.fetch = jest.fn();

describe('GET /api/gateways - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 500 error when an unexpected error occurs', async () => {
    // Mock the gateway registry to throw an error
    jest.doMock('@/lib/gateway-registry', () => ({
      getAllGateways: () => {
        throw new Error('Unexpected registry error');
      },
      getAllActiveGatewayIds: jest.fn(() => []),
    }));

    // Clear module cache and reimport
    jest.resetModules();

    // Re-mock Sentry after resetModules
    jest.doMock('@sentry/nextjs', () => ({
      startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
      captureException: jest.fn(),
    }));

    const { GET } = require('../route');
    const Sentry = require('@sentry/nextjs');

    const request = new NextRequest('http://localhost:3000/api/gateways', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch gateways');
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

describe('POST /api/gateways/refresh - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CACHE_WARMING_SECRET = 'test-secret-123';
  });

  it('should return 500 error when an unexpected error occurs', async () => {
    // Mock the gateway registry to throw an error
    jest.doMock('@/lib/gateway-registry', () => ({
      getAllActiveGatewayIds: () => {
        throw new Error('Unexpected registry error');
      },
      getAllGateways: jest.fn(() => []),
    }));

    // Clear module cache and reimport
    jest.resetModules();

    // Re-mock Sentry after resetModules
    jest.doMock('@sentry/nextjs', () => ({
      startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
      captureException: jest.fn(),
    }));

    const { POST } = require('../route');
    const Sentry = require('@sentry/nextjs');

    const request = new NextRequest('http://localhost:3000/api/gateways', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer test-secret-123',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to refresh gateways');
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
