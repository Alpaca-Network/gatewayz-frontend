import { streamChatResponse } from '../streaming';
import { StreamCoordinator } from '../stream-coordinator';
import { TextEncoder } from 'util'; // Use node's util for TextEncoder if needed, or global

// Mock dependencies
jest.mock('../stream-coordinator', () => ({
  StreamCoordinator: {
    handleAuthError: jest.fn(),
    getApiKey: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;
// Ensure TextEncoder/TextDecoder are available
global.TextEncoder = TextEncoder;
// TextDecoder is usually global in Node 11+
// global.TextDecoder = TextDecoder; 

describe('streamChatResponse', () => {
  const url = 'https://api.example.com/chat';
  const apiKey = 'test-api-key';
  const requestBody = { model: 'gpt-4', messages: [] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retry after 401 auth refresh even if API key is the same', async () => {
    // Setup
    const sameApiKey = 'test-api-key';
    
    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    // Mock reader for successful response
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
      cancel: jest.fn(),
    };

    // Second call: Success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => mockReader,
      },
    });

    // Mock StreamCoordinator behavior
    (StreamCoordinator.handleAuthError as jest.Mock).mockResolvedValue(undefined);
    (StreamCoordinator.getApiKey as jest.Mock).mockReturnValue(sameApiKey);

    // Execute
    const generator = streamChatResponse(url, apiKey, requestBody);
    const result = [];
    
    for await (const chunk of generator) {
      result.push(chunk);
    }

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(StreamCoordinator.handleAuthError).toHaveBeenCalled();
    expect(StreamCoordinator.getApiKey).toHaveBeenCalled();
    
    // Check results
    // The generator yields chunks.
    // Chunk 1: { content: 'Hello' }
    // Chunk 2: { done: true } (from [DONE])
    // Chunk 3: { done: true } (final yield)
    
    const contentChunks = result.filter(c => c.content);
    expect(contentChunks.length).toBeGreaterThan(0);
    expect(contentChunks[0].content).toBe('Hello');
  });

  it('should throw "Max retries exceeded" if 401 persists after refresh', async () => {
    // Setup
    const sameApiKey = 'test-api-key';
    
    // Always return 401
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    // Mock StreamCoordinator behavior
    (StreamCoordinator.handleAuthError as jest.Mock).mockResolvedValue(undefined);
    (StreamCoordinator.getApiKey as jest.Mock).mockReturnValue(sameApiKey);

    // Execute with maxRetries = 3
    const generator = streamChatResponse(url, apiKey, requestBody, 0, 3); 
    
    // Assert
    await expect(async () => {
      for await (const chunk of generator) {
        // consume
      }
    }).rejects.toThrow('Authentication failed: Max retries exceeded after refresh.');
    
    // Initial call (0) -> 401 -> retry(1)
    // Retry(1) -> 401 -> retry(2)
    // Retry(2) -> 401 -> retry(3)
    // Retry(3) -> 401 -> throw
    // Total 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4); 
  });
});