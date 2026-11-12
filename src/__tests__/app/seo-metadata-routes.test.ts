import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('robots.txt and sitemap.xml', () => {
  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) =>
    Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []
  );

  it('points crawlers at the beta sitemap', () => {
    expect(robots().sitemap).toBe('https://beta.gatewayz.ai/sitemap.xml');
  });

  it('never lists a URL that robots.txt blocks', () => {
    for (const { url } of sitemap()) {
      const path = new URL(url).pathname;
      for (const blocked of disallow) {
        expect(path.startsWith(blocked)).toBe(false);
      }
    }
  });

  it('keeps authenticated and transactional areas out of crawling', () => {
    expect(disallow).toEqual(expect.arrayContaining(['/api/', '/settings', '/checkout', '/onboarding']));
  });
});
