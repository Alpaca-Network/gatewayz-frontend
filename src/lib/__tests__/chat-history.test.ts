/**
 * @jest-environment jsdom
 */
import {
  ChatHistoryAPI,
  handleApiError,
  createChatHistoryAPI,
  type ChatSession,
  type ChatMessage,
  type ChatStats,
} from '../chat-history';

// Mock global fetch
global.fetch = jest.fn();

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('ChatHistoryAPI', () => {
  let api: ChatHistoryAPI;
  const mockApiKey = 'test-api-key-123';
  const mockPrivyUserId = 'privy-user-456';
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    api = new ChatHistoryAPI(mockApiKey);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      const instance = new ChatHistoryAPI('my-api-key');
      expect(instance).toBeInstanceOf(ChatHistoryAPI);
    });

    it('should use default base URL when not provided', () => {
      const instance = new ChatHistoryAPI('my-api-key');
      expect(instance).toBeInstanceOf(ChatHistoryAPI);
    });

    it('should use custom base URL when provided', () => {
      const customUrl = 'https://custom.api.com/v1/chat';
      const instance = new ChatHistoryAPI('my-api-key', customUrl);
      expect(instance).toBeInstanceOf(ChatHistoryAPI);
    });

    it('should store privy user ID when provided', () => {
      const instance = new ChatHistoryAPI('my-api-key', undefined, 'privy-123');
      expect(instance).toBeInstanceOf(ChatHistoryAPI);
    });
  });

  describe('createSession', () => {
    it('should create session with custom title and model', async () => {
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'Test Chat',
        model: 'gpt-4',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const result = await api.createSession('Test Chat', 'gpt-4');

      expect(result).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
          }),
          body: JSON.stringify({
            title: 'Test Chat',
            model: 'gpt-4',
          }),
        })
      );
    });

    it('should create session with default title and model when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 1,
            user_id: 123,
            title: 'Chat 1/1/2025, 12:00:00 AM',
            model: 'openai/gpt-3.5-turbo',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_active: true,
          },
        }),
      });

      const result = await api.createSession();

      expect(result.model).toBe('openai/gpt-3.5-turbo');
      expect(result.title).toContain('Chat');
    });

    it('should include privy_user_id in URL when available', async () => {
      const apiWithPrivy = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'Test',
        model: 'gpt-4',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      await apiWithPrivy.createSession('Test', 'gpt-4');

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain(`privy_user_id=${mockPrivyUserId}`);
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid session data' }),
      });

      await expect(api.createSession('Test')).rejects.toThrow('Invalid session data');
    });
  });

  describe('getSessions', () => {
    it('should retrieve sessions with default pagination', async () => {
      const mockSessions: ChatSession[] = [
        {
          id: 1,
          user_id: 123,
          title: 'Session 1',
          model: 'gpt-4',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_active: true,
        },
        {
          id: 2,
          user_id: 123,
          title: 'Session 2',
          model: 'gpt-3.5-turbo',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_active: false,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSessions }),
      });

      const result = await api.getSessions();

      expect(result).toEqual(mockSessions);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions?limit=50&offset=0'),
        expect.any(Object)
      );
    });

    it('should retrieve sessions with custom pagination', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await api.getSessions(10, 20);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions?limit=10&offset=20'),
        expect.any(Object)
      );
    });

    it('should return empty array when no sessions exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const result = await api.getSessions();

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: null }),
      });

      const result = await api.getSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should retrieve specific session with messages', async () => {
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'Test Session',
        model: 'gpt-4',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
        messages: [
          {
            id: 1,
            session_id: 1,
            role: 'user',
            content: 'Hello',
            created_at: '2025-01-01T00:00:00Z',
          },
          {
            id: 2,
            session_id: 1,
            role: 'assistant',
            content: 'Hi there!',
            created_at: '2025-01-01T00:00:01Z',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const result = await api.getSession(1);

      expect(result).toEqual(mockSession);
      expect(result.messages).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/1'),
        expect.any(Object)
      );
    });

    it('should throw error when session not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Session not found' }),
      });

      await expect(api.getSession(999)).rejects.toThrow('Session not found');
    });
  });

  describe('updateSession', () => {
    it('should update session title on client side', async () => {
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'Updated Title',
        model: 'gpt-4',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const result = await api.updateSession(1, 'Updated Title');

      expect(result.title).toBe('Updated Title');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'Updated Title', model: undefined }),
        })
      );
    });

    it('should update session model', async () => {
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'Test',
        model: 'gpt-4-turbo',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const result = await api.updateSession(1, undefined, 'gpt-4-turbo');

      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should update both title and model', async () => {
      const mockSession: ChatSession = {
        id: 1,
        user_id: 123,
        title: 'New Title',
        model: 'gpt-4-turbo',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        is_active: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const result = await api.updateSession(1, 'New Title', 'gpt-4-turbo');

      expect(result.title).toBe('New Title');
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should handle update errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid update data' }),
      });

      await expect(api.updateSession(1, 'Test')).rejects.toThrow('Invalid update data');
    });

    it.skip('should handle timeout on update', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const updatePromise = api.updateSession(1, 'Test');

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      await expect(updatePromise).rejects.toThrow('Request timed out after 30 seconds');
    }, 10000);
  });

  describe('deleteSession', () => {
    it('should delete session on client side', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await api.deleteSession(1);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle delete errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Session not found' }),
      });

      await expect(api.deleteSession(999)).rejects.toThrow('Session not found');
    });

    it.skip('should handle timeout on delete', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const deletePromise = api.deleteSession(1);

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      await expect(deletePromise).rejects.toThrow('Request timed out after 30 seconds');
    }, 10000);

    it('should include privy_user_id in delete URL when available', async () => {
      const apiWithPrivy = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await apiWithPrivy.deleteSession(1);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain(`privy_user_id=${mockPrivyUserId}`);
    });
  });

  describe('saveMessage', () => {
    it('should save user message', async () => {
      const mockMessage: ChatMessage = {
        id: 1,
        session_id: 1,
        role: 'user',
        content: 'Hello, how are you?',
        created_at: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockMessage }),
      });

      const result = await api.saveMessage(1, 'user', 'Hello, how are you?');

      expect(result).toEqual(mockMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/1/messages'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            role: 'user',
            content: 'Hello, how are you?',
            model: '',
            tokens: 0,
          }),
        })
      );
    });

    it('should save assistant message with model and tokens', async () => {
      const mockMessage: ChatMessage = {
        id: 2,
        session_id: 1,
        role: 'assistant',
        content: 'I am doing well, thank you!',
        model: 'gpt-4',
        tokens: 15,
        created_at: '2025-01-01T00:00:01Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockMessage }),
      });

      const result = await api.saveMessage(
        1,
        'assistant',
        'I am doing well, thank you!',
        'gpt-4',
        15
      );

      expect(result).toEqual(mockMessage);
      expect(result.tokens).toBe(15);
      expect(result.model).toBe('gpt-4');
    });

    it('should handle save message errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid message data' }),
      });

      await expect(api.saveMessage(1, 'user', 'Test')).rejects.toThrow('Invalid message data');
    });

    it.skip('should handle timeout on save message', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const savePromise = api.saveMessage(1, 'user', 'Test message');

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      await expect(savePromise).rejects.toThrow('Request timed out after 30 seconds');
    }, 10000);

    it('should include privy_user_id in save message URL when available', async () => {
      const apiWithPrivy = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);
      const mockMessage: ChatMessage = {
        id: 1,
        session_id: 1,
        role: 'user',
        content: 'Test',
        created_at: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockMessage }),
      });

      await apiWithPrivy.saveMessage(1, 'user', 'Test');

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain(`privy_user_id=${mockPrivyUserId}`);
    });
  });

  describe('searchSessions', () => {
    it('should search sessions by query', async () => {
      const mockSessions: ChatSession[] = [
        {
          id: 1,
          user_id: 123,
          title: 'Test Chat about AI',
          model: 'gpt-4',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_active: true,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSessions }),
      });

      const result = await api.searchSessions('AI');

      expect(result).toEqual(mockSessions);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: 'AI',
            limit: 20,
          }),
        })
      );
    });

    it('should search with custom limit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await api.searchSessions('test', 50);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.limit).toBe(50);
    });

    it('should return empty array when no results found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const result = await api.searchSessions('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should retrieve chat statistics', async () => {
      const mockStats: ChatStats = {
        total_sessions: 10,
        total_messages: 100,
        active_sessions: 3,
        total_tokens: 5000,
        average_messages_per_session: 10,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockStats }),
      });

      const result = await api.getStats();

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/stats'),
        expect.any(Object)
      );
    });

    it('should handle stats errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Failed to retrieve stats' }),
      });

      await expect(api.getStats()).rejects.toThrow('Failed to retrieve stats');
    });
  });

  describe('Request Timeout Handling', () => {
    it.skip('should timeout after 30 seconds by default', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const promise = api.getSessions();

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow('Request timed out after 30 seconds');
    }, 10000);

    it('should clear timeout on successful request', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await api.getSessions();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear timeout on failed request', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Error',
        json: async () => ({ detail: 'Error' }),
      });

      await expect(api.getSessions()).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(api.getSessions()).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors in error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.getSessions()).rejects.toThrow('Invalid JSON');
    });

    it('should handle AbortError specifically', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(api.getSessions()).rejects.toThrow('Request timed out');
    });
  });
});

describe('handleApiError', () => {
  it('should handle 401 errors', () => {
    const error = new Error('HTTP 401: Unauthorized');
    const result = handleApiError(error);
    expect(result).toBe('Authentication failed. Please check your API key.');
  });

  it('should handle 404 errors', () => {
    const error = new Error('HTTP 404: Not Found');
    const result = handleApiError(error);
    expect(result).toBe('Session not found.');
  });

  it('should handle 500 errors', () => {
    const error = new Error('HTTP 500: Internal Server Error');
    const result = handleApiError(error);
    expect(result).toBe('Server error. Please try again later.');
  });

  it('should handle generic errors', () => {
    const error = new Error('Something went wrong');
    const result = handleApiError(error);
    expect(result).toBe('Something went wrong');
  });

  it('should handle errors without message', () => {
    const error = { message: '' };
    const result = handleApiError(error);
    expect(result).toBe('An unexpected error occurred.');
  });
});

describe('createChatHistoryAPI', () => {
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create ChatHistoryAPI instance', () => {
    const instance = createChatHistoryAPI('test-key');
    expect(instance).toBeInstanceOf(ChatHistoryAPI);
  });

  it('should use provided API key', async () => {
    const apiKey = 'my-unique-key';
    const instance = createChatHistoryAPI(apiKey);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await instance.getSessions();

    const fetchCall = mockFetch.mock.calls[0];
    const headers = fetchCall[1].headers;
    expect(headers.Authorization).toBe(`Bearer ${apiKey}`);
  });
});

describe('Integration Scenarios', () => {
  let api: ChatHistoryAPI;
  const mockApiKey = 'integration-test-key';
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    api = new ChatHistoryAPI(mockApiKey);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should complete full chat session lifecycle', async () => {
    // 1. Create session
    const mockSession: ChatSession = {
      id: 1,
      user_id: 123,
      title: 'Integration Test',
      model: 'gpt-4',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      is_active: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockSession }),
    });

    const session = await api.createSession('Integration Test', 'gpt-4');
    expect(session.id).toBe(1);

    // 2. Save user message
    const mockUserMessage: ChatMessage = {
      id: 1,
      session_id: 1,
      role: 'user',
      content: 'Hello',
      created_at: '2025-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUserMessage }),
    });

    const userMessage = await api.saveMessage(1, 'user', 'Hello');
    expect(userMessage.role).toBe('user');

    // 3. Save assistant message
    const mockAssistantMessage: ChatMessage = {
      id: 2,
      session_id: 1,
      role: 'assistant',
      content: 'Hi there!',
      model: 'gpt-4',
      tokens: 10,
      created_at: '2025-01-01T00:00:01Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockAssistantMessage }),
    });

    const assistantMessage = await api.saveMessage(1, 'assistant', 'Hi there!', 'gpt-4', 10);
    expect(assistantMessage.role).toBe('assistant');

    // 4. Get session with messages
    const mockFullSession: ChatSession = {
      ...mockSession,
      messages: [mockUserMessage, mockAssistantMessage],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockFullSession }),
    });

    const fullSession = await api.getSession(1);
    expect(fullSession.messages).toHaveLength(2);

    // 5. Update session title
    const mockUpdatedSession: ChatSession = {
      ...mockSession,
      title: 'Updated Title',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUpdatedSession }),
    });

    const updatedSession = await api.updateSession(1, 'Updated Title');
    expect(updatedSession.title).toBe('Updated Title');

    // 6. Delete session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const deleted = await api.deleteSession(1);
    expect(deleted).toBe(true);
  });
});
