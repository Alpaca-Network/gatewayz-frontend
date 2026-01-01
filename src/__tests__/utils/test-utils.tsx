/**
 * Test Utilities
 *
 * Shared testing utilities for consistent test setup across the application.
 * Includes:
 * - Custom render function with all providers
 * - Mock data factories
 * - Common test helpers
 * - API mocking utilities
 */

import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { PrivyProvider } from '@privy-io/react-auth'
import { ThemeProvider } from 'next-themes'

/**
 * Mock User Data
 */
export const mockUser = {
  id: 1,
  privyId: 'test-privy-id-123',
  email: 'test@gatewayz.ai',
  displayName: 'Test User',
  apiKey: 'test-api-key-123',
  credits: 10000,
  tier: 'pro' as const,
  subscriptionStatus: 'active' as const,
  subscriptionEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
}

/**
 * Mock Session Data
 */
export const mockSession = {
  id: 1,
  userId: mockUser.id,
  title: 'Test Chat Session',
  model: 'gpt-4',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true,
  messages: [],
}

/**
 * Mock Message Data
 */
export const mockMessage = {
  id: 1,
  sessionId: mockSession.id,
  role: 'user' as const,
  content: 'Test message content',
  model: 'gpt-4',
  tokens: 10,
  createdAt: new Date().toISOString(),
}

/**
 * Mock Model Data
 */
export const mockModel = {
  name: 'gpt-4',
  isFree: false,
  tokens: '128k',
  category: 'Chat',
  description: 'Most capable GPT-4 model',
  developer: 'OpenAI',
  context: 128000,
  inputCost: 30,
  outputCost: 60,
  modalities: ['text'],
  series: 'gpt-4',
  supportedParameters: ['temperature', 'top_p', 'max_tokens'],
}

/**
 * Mock Privy Configuration
 */
const mockPrivyConfig = {
  appId: 'test-privy-app-id',
  config: {
    appearance: {
      theme: 'light' as const,
    },
    embeddedWallets: {
      createOnLogin: 'off' as const,
    },
  },
}

/**
 * All Providers Wrapper
 *
 * Wraps components with all necessary providers for testing.
 */
interface AllProvidersProps {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PrivyProvider {...mockPrivyConfig}>
        {children}
      </PrivyProvider>
    </ThemeProvider>
  )
}

/**
 * Custom Render Function
 *
 * Renders a component with all providers and returns testing utilities.
 *
 * @example
 * const { getByText } = renderWithProviders(<MyComponent />)
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

/**
 * Mock API Response
 *
 * Creates a mock Response object for testing API routes.
 *
 * @example
 * const response = mockApiResponse({ success: true, data: {} })
 */
export function mockApiResponse<T = any>(
  data: T,
  status: number = 200,
  statusText: string = 'OK'
): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Mock Fetch
 *
 * Creates a mock fetch function for testing.
 *
 * @example
 * global.fetch = mockFetch({ success: true, data: {} })
 */
export function mockFetch<T = any>(responseData: T, status: number = 200) {
  return jest.fn(() =>
    Promise.resolve(mockApiResponse(responseData, status))
  )
}

/**
 * Mock Streaming Response
 *
 * Creates a mock streaming response for testing SSE/streaming APIs.
 *
 * @example
 * const stream = mockStreamingResponse(['chunk 1', 'chunk 2'])
 */
export function mockStreamingResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
      })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
    },
  })
}

/**
 * Mock LocalStorage
 *
 * Creates a mock localStorage for testing.
 *
 * @example
 * const localStorage = mockLocalStorage()
 */
export function mockLocalStorage() {
  let store: Record<string, string> = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  }
}

/**
 * Wait for
 *
 * Utility to wait for a condition to be true.
 *
 * @example
 * await waitFor(() => expect(element).toBeInTheDocument())
 */
export async function waitFor(
  callback: () => void,
  options?: { timeout?: number; interval?: number }
) {
  const { timeout = 3000, interval = 50 } = options || {}
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      callback()
      return
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  // Last attempt - will throw if still failing
  callback()
}

/**
 * Mock Next Router
 *
 * Creates a mock Next.js router for testing.
 *
 * @example
 * const router = mockNextRouter({ pathname: '/test' })
 */
export function mockNextRouter(overrides?: any) {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    basePath: '',
    locale: 'en',
    locales: ['en'],
    defaultLocale: 'en',
    isReady: true,
    isFallback: false,
    isPreview: false,
    isLocaleDomain: false,
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    ...overrides,
  }
}

/**
 * Create Mock Request
 *
 * Creates a mock Next.js Request object for testing API routes.
 *
 * @example
 * const request = createMockRequest({ method: 'POST', body: { data: 'test' } })
 */
export function createMockRequest(options: {
  method?: string
  headers?: Record<string, string>
  body?: any
  url?: string
  searchParams?: Record<string, string>
}): Request {
  const {
    method = 'GET',
    headers = {},
    body = null,
    url = 'http://localhost:3000/api/test',
    searchParams = {},
  } = options

  const urlObj = new URL(url)
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })

  return new Request(urlObj.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
  })
}

/**
 * Create Mock User with Custom Data
 *
 * @example
 * const user = createMockUser({ tier: 'max', credits: 50000 })
 */
export function createMockUser(overrides?: Partial<typeof mockUser>) {
  return {
    ...mockUser,
    ...overrides,
  }
}

/**
 * Create Mock Session with Custom Data
 *
 * @example
 * const session = createMockSession({ model: 'gpt-3.5-turbo' })
 */
export function createMockSession(overrides?: Partial<typeof mockSession>) {
  return {
    ...mockSession,
    ...overrides,
  }
}

/**
 * Create Mock Message with Custom Data
 *
 * @example
 * const message = createMockMessage({ role: 'assistant', content: 'Response' })
 */
export function createMockMessage(overrides?: Partial<typeof mockMessage>) {
  return {
    ...mockMessage,
    ...overrides,
  }
}

/**
 * Create Mock Model with Custom Data
 *
 * @example
 * const model = createMockModel({ name: 'claude-3-opus', developer: 'Anthropic' })
 */
export function createMockModel(overrides?: Partial<typeof mockModel>) {
  return {
    ...mockModel,
    ...overrides,
  }
}

/**
 * Setup Test Environment
 *
 * Sets up common test environment variables and mocks.
 * Call this in beforeEach or beforeAll.
 *
 * @example
 * beforeEach(() => {
 *   setupTestEnvironment()
 * })
 */
export function setupTestEnvironment() {
  // Mock environment variables
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000/api'
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-privy-app-id'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123'

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage(),
    writable: true,
  })

  // Mock fetch
  global.fetch = mockFetch({ success: true })

  // Mock console methods to reduce noise
  jest.spyOn(console, 'error').mockImplementation()
  jest.spyOn(console, 'warn').mockImplementation()
}

/**
 * Cleanup Test Environment
 *
 * Cleans up test environment after tests.
 * Call this in afterEach or afterAll.
 *
 * @example
 * afterEach(() => {
 *   cleanupTestEnvironment()
 * })
 */
export function cleanupTestEnvironment() {
  jest.clearAllMocks()
  jest.restoreAllMocks()
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
