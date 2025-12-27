// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder used by viem and Privy
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock fetch for Privy SDK (simple mock for tests)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    headers: new Map(),
  })
)

// Mock Headers class with case-insensitive header names (like real HTTP headers)
global.Headers = class Headers {
  constructor(init) {
    this.map = new Map()
    if (init) {
      if (init instanceof Headers) {
        init.forEach((value, key) => this.map.set(key.toLowerCase(), value))
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.map.set(key.toLowerCase(), value))
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.map.set(key.toLowerCase(), value))
      }
    }
  }

  set(name, value) {
    this.map.set(name.toLowerCase(), value)
  }

  get(name) {
    return this.map.get(name.toLowerCase()) || null
  }

  has(name) {
    return this.map.has(name.toLowerCase())
  }

  delete(name) {
    this.map.delete(name.toLowerCase())
  }

  forEach(callback) {
    this.map.forEach((value, key) => callback(value, key, this))
  }

  entries() {
    return this.map.entries()
  }

  keys() {
    return this.map.keys()
  }

  values() {
    return this.map.values()
  }
}

// Minimal Request mock - NextRequest will handle the actual implementation
global.Request = class Request {
  constructor(input, init = {}) {
    // Store input for NextRequest to use
    this._input = input
    this._init = init
    this._body = init?.body

    // Define read-only url getter
    Object.defineProperty(this, 'url', {
      get() {
        return typeof input === 'string' ? input : input?.url || ''
      },
      enumerable: true
    })

    // Define read-only method getter
    Object.defineProperty(this, 'method', {
      get() {
        return init?.method || 'GET'
      },
      enumerable: true
    })

    // Define read-only headers getter
    Object.defineProperty(this, 'headers', {
      get() {
        if (!this._headers) {
          this._headers = new Headers(init?.headers || {})
        }
        return this._headers
      },
      enumerable: true
    })
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body)
    }
    return this._body
  }

  async text() {
    if (typeof this._body === 'string') {
      return this._body
    }
    return JSON.stringify(this._body)
  }
}

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Headers(init.headers || {})
    this.ok = this.status >= 200 && this.status < 300
  }

  async json() {
    const text = await this.text()
    return JSON.parse(text)
  }

  async text() {
    // Handle string body
    if (typeof this.body === 'string') {
      return this.body
    }

    // Handle ReadableStream (for SSE and streaming responses)
    if (this.body && typeof this.body.getReader === 'function') {
      const reader = this.body.getReader()
      const decoder = new TextDecoder()
      let result = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          result += decoder.decode(value, { stream: true })
        }
        return result
      } finally {
        reader.releaseLock()
      }
    }

    // Handle other types (objects, null, etc.)
    if (this.body === null || this.body === undefined) {
      return ''
    }

    // Fallback to JSON stringify
    return JSON.stringify(this.body)
  }

  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        ...init.headers,
        'Content-Type': 'application/json'
      }
    })
  }
}

// Mock lucide-react icons - create mock components that return the icon name as text
jest.mock('lucide-react', () => {
  const React = require('react');
  const createIconMock = (name) => {
    const IconComponent = (props) => React.createElement('span', { 'data-testid': `icon-${name.toLowerCase()}`, ...props }, name);
    IconComponent.displayName = name;
    return IconComponent;
  };

  return {
    __esModule: true,
    // Chat-related icons
    Send: createIconMock('Send'),
    Image: createIconMock('Image'),
    Video: createIconMock('Video'),
    Mic: createIconMock('Mic'),
    X: createIconMock('X'),
    RefreshCw: createIconMock('RefreshCw'),
    Plus: createIconMock('Plus'),
    FileText: createIconMock('FileText'),
    Square: createIconMock('Square'),
    Camera: createIconMock('Camera'),
    // Layout icons
    Menu: createIconMock('Menu'),
    Pencil: createIconMock('Pencil'),
    Lock: createIconMock('Lock'),
    Unlock: createIconMock('Unlock'),
    Shield: createIconMock('Shield'),
    ImageIcon: createIconMock('ImageIcon'),
    BarChart3: createIconMock('BarChart3'),
    Code2: createIconMock('Code2'),
    Lightbulb: createIconMock('Lightbulb'),
    MoreHorizontal: createIconMock('MoreHorizontal'),
    // Other commonly used icons
    Coins: createIconMock('Coins'),
    Crown: createIconMock('Crown'),
    Copy: createIconMock('Copy'),
    Check: createIconMock('Check'),
    ChevronDown: createIconMock('ChevronDown'),
    ChevronUp: createIconMock('ChevronUp'),
    ChevronLeft: createIconMock('ChevronLeft'),
    ChevronRight: createIconMock('ChevronRight'),
    Search: createIconMock('Search'),
    Settings: createIconMock('Settings'),
    User: createIconMock('User'),
    LogOut: createIconMock('LogOut'),
    Trash: createIconMock('Trash'),
    Edit: createIconMock('Edit'),
    Eye: createIconMock('Eye'),
    EyeOff: createIconMock('EyeOff'),
    AlertCircle: createIconMock('AlertCircle'),
    Info: createIconMock('Info'),
    ExternalLink: createIconMock('ExternalLink'),
    Share: createIconMock('Share'),
    ThumbsUp: createIconMock('ThumbsUp'),
    ThumbsDown: createIconMock('ThumbsDown'),
    RotateCcw: createIconMock('RotateCcw'),
    Loader2: createIconMock('Loader2'),
    ArrowLeft: createIconMock('ArrowLeft'),
    ArrowRight: createIconMock('ArrowRight'),
    Home: createIconMock('Home'),
    Star: createIconMock('Star'),
    Heart: createIconMock('Heart'),
    MessageSquare: createIconMock('MessageSquare'),
    Zap: createIconMock('Zap'),
  };
})

// Mock jose library (ESM module causing issues in Jest)
jest.mock('jose', () => ({
  compactDecrypt: jest.fn(),
  compactVerify: jest.fn(),
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
}))

// Mock ofetch library (ESM module causing issues in Jest)
jest.mock('ofetch', () => ({
  ofetch: jest.fn(),
  __esModule: true,
  default: jest.fn(),
}))

// Mock uint8arrays library (ESM module used by @walletconnect)
jest.mock('uint8arrays', () => ({
  compare: jest.fn(),
  concat: jest.fn(),
  equals: jest.fn(),
  fromString: jest.fn(),
  toString: jest.fn(),
  __esModule: true,
}))

// Mock @coinbase/wallet-sdk library (ESM module)
jest.mock('@coinbase/wallet-sdk', () => ({
  CoinbaseWalletSDK: jest.fn().mockImplementation(() => ({
    makeWeb3Provider: jest.fn(),
  })),
  __esModule: true,
}))

// Mock @marsidev/react-turnstile (ESM module used by Privy)
jest.mock('@marsidev/react-turnstile', () => ({
  Turnstile: () => null,
  DEFAULT_CONTAINER_ID: 'cf-turnstile',
  DEFAULT_ONLOAD_NAME: 'onloadTurnstileCallback',
  DEFAULT_SCRIPT_ID: 'cf-turnstile-script',
  SCRIPT_URL: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
  __esModule: true,
}))

// Mock next/server NextResponse to use our Response mock
jest.mock('next/server', () => {
  const actualModule = jest.requireActual('next/server')

  class MockNextResponse extends global.Response {
    constructor(body, init) {
      super(body, init)
    }
  }

  return {
    ...actualModule,
    NextResponse: MockNextResponse
  }
})
