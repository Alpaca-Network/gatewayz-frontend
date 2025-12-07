// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { fetch, Headers, Request, Response } from 'whatwg-fetch'

// Polyfill for TextEncoder/TextDecoder used by viem and Privy
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill for fetch used by Privy
global.fetch = fetch
global.Headers = Headers
global.Request = Request
global.Response = Response

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
