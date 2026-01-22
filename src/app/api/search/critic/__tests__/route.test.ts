/**
 * Tests for the search critic API route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn(() => 'mock-model')),
}));

import { generateText } from 'ai';
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

describe('POST /api/search/critic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GOOGLE_AI_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return needsSearch=true when critic says YES', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'YES',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 1 },
    } as any);

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Who is the CEO of OpenAI?' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(true);
    expect(data.reason).toBe('YES');
  });

  it('should return needsSearch=false when critic says NO', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'NO',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 1 },
    } as any);

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Explain recursion in programming' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(false);
    expect(data.reason).toBe('NO');
  });

  it('should return error for missing query', async () => {
    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Query is required');
    expect(data.needsSearch).toBe(false);
  });

  it('should skip classification for very short queries', async () => {
    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Hi' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(false);
    expect(data.skipped).toBe(true);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should handle missing API key gracefully', async () => {
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'What is the weather today?' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(false);
    expect(data.error).toBe('missing_api_key');
  });

  it('should handle API errors gracefully', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Current stock prices' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return safe default on error
    expect(data.needsSearch).toBe(false);
    expect(data.error).toBe('API rate limit exceeded');
  });

  it('should handle YES with extra text (e.g., "YES - needs current info")', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'YES - This query asks about current leadership',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 10 },
    } as any);

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Who is the president of France?' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(true);
  });

  it('should handle lowercase response', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'yes',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 1 },
    } as any);

    const request = new NextRequest('http://localhost/api/search/critic', {
      method: 'POST',
      body: JSON.stringify({ query: 'Bitcoin price' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.needsSearch).toBe(true);
  });
});
