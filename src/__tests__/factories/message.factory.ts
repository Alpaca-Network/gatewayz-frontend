/**
 * Message Factory
 *
 * Factory for creating test chat message data.
 */

import { faker } from '@faker-js/faker'

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
 * Create a chat message
 */
export function createMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  const role = overrides?.role || faker.helpers.arrayElement(['user', 'assistant'] as const)

  return {
    id: faker.number.int({ min: 1, max: 1000000 }),
    sessionId: faker.number.int({ min: 1, max: 100000 }),
    role,
    content: generateContentForRole(role),
    model: role === 'assistant' ? 'gpt-4' : undefined,
    tokens: role === 'assistant' ? faker.number.int({ min: 10, max: 500 }) : undefined,
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  }
}

/**
 * Create a user message
 */
export function createUserMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return createMessage({
    role: 'user',
    content: faker.lorem.sentence(),
    ...overrides,
  })
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return createMessage({
    role: 'assistant',
    content: faker.lorem.paragraphs(2),
    model: 'gpt-4',
    tokens: faker.number.int({ min: 50, max: 500 }),
    ...overrides,
  })
}

/**
 * Create a system message
 */
export function createSystemMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return createMessage({
    role: 'system',
    content: 'You are a helpful assistant.',
    ...overrides,
  })
}

/**
 * Create a conversation (alternating user/assistant messages)
 */
export function createConversation(
  turns: number = 5,
  sessionId?: number
): ChatMessage[] {
  const messages: ChatMessage[] = []
  const sid = sessionId || faker.number.int({ min: 1, max: 100000 })

  for (let i = 0; i < turns * 2; i++) {
    messages.push(
      createMessage({
        sessionId: sid,
        role: i % 2 === 0 ? 'user' : 'assistant',
      })
    )
  }

  return messages
}

/**
 * Create multiple messages
 */
export function createMessages(count: number, overrides?: Partial<ChatMessage>): ChatMessage[] {
  return Array.from({ length: count }, () => createMessage(overrides))
}

/**
 * Helper to generate realistic content based on role
 */
function generateContentForRole(role: 'user' | 'assistant' | 'system'): string {
  switch (role) {
    case 'user':
      return faker.helpers.arrayElement([
        'Can you help me with this problem?',
        'What do you think about this idea?',
        'How do I implement this feature?',
        'Explain this concept to me.',
        'Write a function that does X.',
        faker.lorem.sentence(),
      ])
    case 'assistant':
      return faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }))
    case 'system':
      return 'You are a helpful assistant.'
  }
}
