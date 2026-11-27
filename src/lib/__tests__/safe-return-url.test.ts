import { safeReturnUrl } from '../safe-return-url';

describe('safeReturnUrl', () => {
  it.each([
    '/',
    '/chat',
    '/chat?model=openai%2Fgpt-4o',
    '/models/openai/gpt-4o#pricing',
    '/settings/keys?tab=api&ref=abc',
  ])('allows same-origin relative path %s', (value) => {
    expect(safeReturnUrl(value)).toBe(value);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/chat'],
    ['backslash host', '/\\evil.com'],
    ['backslash anywhere', '/chat\\..\\'],
    ['absolute https', 'https://evil.com'],
    ['absolute http', 'http://evil.com/chat'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['relative without slash', 'chat'],
    ['tab smuggling', '/\t/evil.com'],
    ['newline smuggling', '/\n/evil.com'],
    ['null byte', '/chat\u0000'],
    ['DEL char', '/chat\u007F'],
    ['space', '/ /evil.com'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(safeReturnUrl(value)).toBe('/');
  });

  it('rejects non-string values', () => {
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl(42)).toBe('/');
    expect(safeReturnUrl(['/chat'])).toBe('/');
  });

  it('rejects overly long values', () => {
    expect(safeReturnUrl('/' + 'a'.repeat(3000))).toBe('/');
  });

  it('uses the provided fallback', () => {
    expect(safeReturnUrl('//evil.com', '/chat')).toBe('/chat');
    expect(safeReturnUrl(null, '/chat')).toBe('/chat');
  });
});
