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
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body
  }

  async text() {
    if (typeof this.body === 'string') {
      return this.body
    }
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Coins: () => 'Coins',
  Crown: () => 'Crown',
  Menu: () => 'Menu',
  Copy: () => 'Copy',
}))

// Mock jose library (ESM module causing issues in Jest)
jest.mock('jose', () => ({
  compactDecrypt: jest.fn(),
  compactVerify: jest.fn(),
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
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
