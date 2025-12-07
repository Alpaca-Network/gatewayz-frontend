// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder used by viem and Privy
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

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
