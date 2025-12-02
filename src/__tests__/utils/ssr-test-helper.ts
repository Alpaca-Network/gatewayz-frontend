/**
 * Shared SSR (Server-Side Rendering) test utilities
 *
 * Provides consistent patterns for testing SSR environment behavior
 * instead of duplicating the same pattern across multiple test files
 */

/**
 * Runs a test in a simulated SSR environment where window is undefined
 *
 * @param fn - The function to execute in SSR context
 * @returns The result of the function
 *
 * @example
 * ```ts
 * it('should handle SSR environment', () => {
 *   const result = runInSSRContext(() => {
 *     return myFunction();
 *   });
 *   expect(result).toBeNull();
 * });
 * ```
 */
export function runInSSRContext<T>(fn: () => T): T {
  const originalWindow = global.window;
  (global as any).window = undefined;

  try {
    return fn();
  } finally {
    global.window = originalWindow;
  }
}

/**
 * Jest test helper that describes a group of SSR-related tests
 *
 * @param functionName - Name of the function being tested
 * @param tests - Object mapping test descriptions to test functions
 *
 * @example
 * ```ts
 * describeSSRBehavior('saveApiKey', {
 *   'should return early without error': () => {
 *     expect(() => runInSSRContext(() => saveApiKey('key'))).not.toThrow();
 *   },
 *   'should not access localStorage': () => {
 *     const spy = jest.spyOn(Storage.prototype, 'setItem');
 *     runInSSRContext(() => saveApiKey('key'));
 *     expect(spy).not.toHaveBeenCalled();
 *     spy.mockRestore();
 *   },
 * });
 * ```
 */
export function describeSSRBehavior(
  functionName: string,
  tests: Record<string, () => void>
): void {
  describe(`${functionName} SSR behavior`, () => {
    for (const [description, testFn] of Object.entries(tests)) {
      it(description, testFn);
    }
  });
}

/**
 * Creates a standard SSR environment test case
 * Use this when you just need to verify a function doesn't throw in SSR
 *
 * @param fn - The function to test
 * @param expectedResult - The expected return value (usually null or undefined)
 *
 * @example
 * ```ts
 * it('should handle SSR', createSSRTest(() => getApiKey(), null));
 * ```
 */
export function createSSRTest<T>(
  fn: () => T,
  expectedResult?: T
): () => void {
  return () => {
    const result = runInSSRContext(fn);
    if (expectedResult !== undefined) {
      expect(result).toEqual(expectedResult);
    } else {
      // Just verify it didn't throw
      expect(true).toBe(true);
    }
  };
}

/**
 * Parameterized SSR tests for multiple functions
 *
 * @example
 * ```ts
 * testSSRFunctions([
 *   { name: 'getApiKey', fn: () => getApiKey(), expected: null },
 *   { name: 'saveApiKey', fn: () => saveApiKey('key'), expected: undefined },
 *   { name: 'getUserData', fn: () => getUserData(), expected: null },
 * ]);
 * ```
 */
export function testSSRFunctions(
  functions: Array<{
    name: string;
    fn: () => unknown;
    expected?: unknown;
  }>
): void {
  describe('SSR Environment Handling', () => {
    it.each(functions)(
      '$name should handle SSR environment gracefully',
      ({ fn, expected }) => {
        const result = runInSSRContext(fn);
        if (expected !== undefined) {
          expect(result).toEqual(expected);
        }
      }
    );
  });
}
