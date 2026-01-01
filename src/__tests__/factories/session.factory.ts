/**
 * Session Factory
 *
 * Factory for creating test chat session data.
 */

import { faker } from '@faker-js/faker'
import { createMessage } from './message.factory'

export interface ChatSession {
  id: number
  userId: number
  title: string
  model: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  messages?: ChatMessage[]
}

export interface ChatMessage {
  id: number
  sessionId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokens?: number
  createdAt: string
}

/**
 * Create a chat session
 */
export function createSession(overrides?: Partial<ChatSession>): ChatSession {
  const models = [
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'gemini-pro',
    'llama-3-70b',
  ]

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    userId: faker.number.int({ min: 1, max: 10000 }),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    model: faker.helpers.arrayElement(models),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    isActive: faker.datatype.boolean(),
    ...overrides,
  }
}

/**
 * Create a session with messages
 */
export function createSessionWithMessages(
  messageCount: number = 5,
  overrides?: Partial<ChatSession>
): ChatSession {
  const session = createSession(overrides)
  const messages = Array.from({ length: messageCount }, (_, i) =>
    createMessage({
      sessionId: session.id,
      role: i % 2 === 0 ? 'user' : 'assistant',
      model: session.model,
    })
  )

  return {
    ...session,
    messages,
  }
}

/**
 * Create an active session
 */
export function createActiveSession(overrides?: Partial<ChatSession>): ChatSession {
  return createSession({
    isActive: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  })
}

/**
 * Create an archived session
 */
export function createArchivedSession(overrides?: Partial<ChatSession>): ChatSession {
  return createSession({
    isActive: false,
    updatedAt: faker.date.past({ years: 1 }).toISOString(),
    ...overrides,
  })
}

/**
 * Create multiple sessions
 */
export function createSessions(count: number, overrides?: Partial<ChatSession>): ChatSession[] {
  return Array.from({ length: count }, () => createSession(overrides))
}
