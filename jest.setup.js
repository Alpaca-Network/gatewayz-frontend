// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Coins: () => 'Coins',
  Crown: () => 'Crown',
  Menu: () => 'Menu',
  Copy: () => 'Copy',
}))
