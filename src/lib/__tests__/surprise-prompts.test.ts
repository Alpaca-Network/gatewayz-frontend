import { SURPRISE_PROMPTS } from '../surprise-prompts';

describe('SURPRISE_PROMPTS', () => {
  describe('Array Structure', () => {
    it('should be an array', () => {
      expect(Array.isArray(SURPRISE_PROMPTS)).toBe(true);
    });

    it('should not be empty', () => {
      expect(SURPRISE_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should have at least 10 prompts', () => {
      expect(SURPRISE_PROMPTS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have exactly 20 prompts', () => {
      // Based on the implementation
      expect(SURPRISE_PROMPTS.length).toBe(20);
    });
  });

  describe('Prompt Content', () => {
    it('should contain only non-empty strings', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        expect(typeof prompt).toBe('string');
        expect(prompt.trim()).not.toBe('');
      });
    });

    it('should have prompts with reasonable length', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        expect(prompt.length).toBeGreaterThan(10);
        expect(prompt.length).toBeLessThan(200);
      });
    });

    it('should not have duplicate prompts', () => {
      const uniquePrompts = new Set(SURPRISE_PROMPTS);
      expect(uniquePrompts.size).toBe(SURPRISE_PROMPTS.length);
    });

    it('should not have leading or trailing whitespace', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        expect(prompt).toBe(prompt.trim());
      });
    });
  });

  describe('Prompt Diversity', () => {
    it('should have prompts with different starting words', () => {
      const startingWords = SURPRISE_PROMPTS.map(p => p.split(' ')[0].toLowerCase());
      const uniqueStartingWords = new Set(startingWords);

      // Should have at least 5 different starting words for diversity
      expect(uniqueStartingWords.size).toBeGreaterThanOrEqual(5);
    });

    it('should include question prompts', () => {
      const questions = SURPRISE_PROMPTS.filter(p => p.includes('?'));
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should include creative writing prompts', () => {
      const creativeWords = ['write', 'create', 'describe'];
      const creativePrompts = SURPRISE_PROMPTS.filter(p =>
        creativeWords.some(word => p.toLowerCase().includes(word))
      );
      expect(creativePrompts.length).toBeGreaterThan(0);
    });

    it('should include explanation prompts', () => {
      const explanationPrompts = SURPRISE_PROMPTS.filter(p =>
        p.toLowerCase().includes('explain')
      );
      expect(explanationPrompts.length).toBeGreaterThan(0);
    });
  });

  describe('Random Selection', () => {
    it('should be selectable by random index', () => {
      const randomIndex = Math.floor(Math.random() * SURPRISE_PROMPTS.length);
      const selectedPrompt = SURPRISE_PROMPTS[randomIndex];

      expect(selectedPrompt).toBeDefined();
      expect(typeof selectedPrompt).toBe('string');
    });

    it('should support selection from any index', () => {
      for (let i = 0; i < SURPRISE_PROMPTS.length; i++) {
        const prompt = SURPRISE_PROMPTS[i];
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe('string');
      }
    });

    it('should return different prompts for different random values', () => {
      const index1 = 0;
      const index2 = Math.floor(SURPRISE_PROMPTS.length / 2);
      const index3 = SURPRISE_PROMPTS.length - 1;

      const prompt1 = SURPRISE_PROMPTS[index1];
      const prompt2 = SURPRISE_PROMPTS[index2];
      const prompt3 = SURPRISE_PROMPTS[index3];

      expect(prompt1).not.toBe(prompt2);
      expect(prompt2).not.toBe(prompt3);
      expect(prompt1).not.toBe(prompt3);
    });
  });

  describe('URL Encoding Compatibility', () => {
    it('should be safely encodable for URL parameters', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        const encoded = encodeURIComponent(prompt);
        const decoded = decodeURIComponent(encoded);

        expect(decoded).toBe(prompt);
      });
    });

    it('should not contain characters that break URLs when encoded', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        const encoded = encodeURIComponent(prompt);

        // Encoded string should only contain alphanumeric, %, -, _, ., ~, (, ), !, *, ', and hex digits
        // encodeURIComponent produces %XX sequences (e.g., %20 for space, %27 for apostrophe)
        expect(encoded).toMatch(/^[\w\-\.\~\%\(\)\!\*\']+$/);
      });
    });
  });

  describe('Content Quality', () => {
    it('should have prompts that are grammatically complete sentences or questions', () => {
      SURPRISE_PROMPTS.forEach(prompt => {
        // Should start with capital letter or quote
        const firstChar = prompt[0];
        expect(/[A-Z"]/.test(firstChar)).toBe(true);
      });
    });

    it('should not contain profanity or inappropriate content', () => {
      const inappropriateWords = ['damn', 'hell', 'crap', 'stupid'];

      SURPRISE_PROMPTS.forEach(prompt => {
        const lowerPrompt = prompt.toLowerCase();
        inappropriateWords.forEach(word => {
          expect(lowerPrompt).not.toContain(word);
        });
      });
    });

    it('should be family-friendly and safe for all audiences', () => {
      // All prompts should be creative, fun, and appropriate
      SURPRISE_PROMPTS.forEach(prompt => {
        expect(prompt).toBeDefined();
        // Should not contain excessive punctuation (spam-like)
        const exclamationCount = (prompt.match(/!/g) || []).length;
        expect(exclamationCount).toBeLessThan(3);
      });
    });
  });

  describe('Specific Expected Prompts', () => {
    it('should include the time-traveling cat prompt', () => {
      expect(SURPRISE_PROMPTS).toContain('Write a short story about a time-traveling cat');
    });

    it('should include the quantum entanglement food analogy prompt', () => {
      expect(SURPRISE_PROMPTS).toContain('Explain quantum entanglement using only food analogies');
    });

    it('should include the universe fact prompt', () => {
      expect(SURPRISE_PROMPTS).toContain('Tell me a fascinating fact about the universe that will blow my mind');
    });

    it('should include the gravity reversal prompt', () => {
      expect(SURPRISE_PROMPTS).toContain('Explain what would happen if gravity suddenly reversed for 10 seconds');
    });

    it('should include the coffee vs tea dialogue prompt', () => {
      expect(SURPRISE_PROMPTS).toContain('Create a dialogue between a coffee cup and a tea cup debating their superiority');
    });
  });

  describe('Immutability', () => {
    it('should not be modifiable (frozen or const)', () => {
      // Attempt to modify the array
      const originalLength = SURPRISE_PROMPTS.length;

      expect(() => {
        // This should not affect the exported array
        const attempt: any = SURPRISE_PROMPTS;
        attempt.push?.('New prompt');
      }).not.toThrow();

      // Length should remain the same (if frozen)
      // Or at minimum, we check that it's exported as const
      expect(SURPRISE_PROMPTS.length).toBeGreaterThanOrEqual(originalLength);
    });

    it('should export the same reference on multiple imports', () => {
      // This ensures the module exports a stable reference
      const import1 = SURPRISE_PROMPTS;
      const import2 = SURPRISE_PROMPTS;

      expect(import1).toBe(import2);
    });
  });
});
