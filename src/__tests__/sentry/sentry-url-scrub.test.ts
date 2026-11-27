import { scrubBreadcrumb, scrubEventUrls, scrubQueryString, scrubUrl } from '@/lib/sentry-url-scrub';

const FAKE = 'fake-value-not-a-key';

describe('scrubUrl', () => {
  it('redacts token, code and key params and keeps the rest', () => {
    const out = scrubUrl(`https://beta.gatewayz.ai/chat?token=${FAKE}&userId=7&code=${FAKE}&returnUrl=%2Fsettings#top`);
    expect(out).not.toContain(FAKE);
    expect(out).toBe('https://beta.gatewayz.ai/chat?token=[Filtered]&userId=7&code=[Filtered]&returnUrl=%2Fsettings#top');
  });

  it('is case-insensitive on the param name', () => {
    expect(scrubUrl(`/x?API_KEY=${FAKE}&Access_Token=${FAKE}`)).toBe('/x?API_KEY=[Filtered]&Access_Token=[Filtered]');
  });

  it('leaves URLs without sensitive params, and non-strings, unchanged', () => {
    expect(scrubUrl('/models?sort=price&page=2')).toBe('/models?sort=price&page=2');
    expect(scrubUrl('/models')).toBe('/models');
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it('also redacts query-like fragments', () => {
    expect(scrubUrl(`/a#/b?token=${FAKE}&x=1`)).toBe('/a#/b?token=[Filtered]&x=1');
    expect(scrubUrl(`/a#code=${FAKE}`)).toBe('/a#code=[Filtered]');
    expect(scrubUrl('/a#section-2')).toBe('/a#section-2');
  });
});

describe('scrubQueryString', () => {
  it('handles a leading "?" and a bare string', () => {
    expect(scrubQueryString(`?token=${FAKE}&a=1`)).toBe('?token=[Filtered]&a=1');
    expect(scrubQueryString(`token=${FAKE}`)).toBe('token=[Filtered]');
  });
});

describe('scrubEventUrls', () => {
  it('redacts request url, query string (all shapes), referer, transaction, url tag and breadcrumbs', () => {
    const event = scrubEventUrls({
      request: {
        url: `https://beta.gatewayz.ai/?token=${FAKE}`,
        query_string: `token=${FAKE}`,
        headers: { Referer: `https://beta.gatewayz.ai/?code=${FAKE}` },
      },
      transaction: `/?token=${FAKE}`,
      tags: { url: `/?code=${FAKE}` },
      breadcrumbs: [
        { data: { from: `/?token=${FAKE}`, to: '/chat' } },
        { data: { url: `https://api.gatewayz.ai/x?api_key=${FAKE}` } },
        { message: `navigated to /?code=${FAKE} ok` },
      ],
    });
    expect(JSON.stringify(event)).not.toContain(FAKE);

    const arr = scrubEventUrls({ request: { query_string: [['token', FAKE], ['a', '1']] as Array<[string, string]> } });
    expect(arr.request?.query_string).toEqual([['token', '[Filtered]'], ['a', '1']]);

    const obj = scrubEventUrls({ request: { query_string: { code: FAKE, a: '1' } } });
    expect(obj.request?.query_string).toEqual({ code: '[Filtered]', a: '1' });
  });

  it('passes null through', () => {
    expect(scrubEventUrls(null)).toBeNull();
    expect(scrubBreadcrumb(null)).toBeNull();
  });
});
