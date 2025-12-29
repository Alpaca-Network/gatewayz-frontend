import { buildPreviewSafeRedirectUrl, DEFAULT_PREVIEW_REDIRECT_ORIGIN } from '../preview-oauth-redirect';

describe('buildPreviewSafeRedirectUrl', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('combines canonical origin with current path, query, and hash', () => {
    const result = buildPreviewSafeRedirectUrl({
      currentHref: 'https://gatewayz-preview.vercel.app/models?id=42#details',
      targetOrigin: 'https://beta.gatewayz.ai',
    });

    expect(result).toBe('https://beta.gatewayz.ai/models?id=42#details');
  });

  it('falls back to default origin when provided origin is invalid', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = buildPreviewSafeRedirectUrl({
      currentHref: 'https://gatewayz-preview.vercel.app/chat',
      targetOrigin: 'invalid-origin',
    });

    expect(result).toBe(DEFAULT_PREVIEW_REDIRECT_ORIGIN);
  });

  it('falls back to default origin when current href is invalid', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = buildPreviewSafeRedirectUrl({
      currentHref: '::not-a-valid-url::',
      targetOrigin: 'https://beta.gatewayz.ai',
    });

    expect(result).toBe(DEFAULT_PREVIEW_REDIRECT_ORIGIN);
  });
});
