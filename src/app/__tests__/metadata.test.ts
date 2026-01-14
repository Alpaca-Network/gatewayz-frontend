import { metadata } from '../metadata';

describe('App Metadata Configuration', () => {
  describe('Basic metadata', () => {
    it('should have correct title', () => {
      expect(metadata.title).toBe('Gatewayz - One Interface To Work With Any LLM');
    });

    it('should have correct description', () => {
      expect(metadata.description).toBe(
        'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.'
      );
    });

    it('should have relevant keywords', () => {
      expect(metadata.keywords).toContain('AI');
      expect(metadata.keywords).toContain('LLM');
      expect(metadata.keywords).toContain('API Gateway');
    });

    it('should have author information', () => {
      expect(metadata.authors).toEqual([{ name: 'Gatewayz' }]);
    });
  });

  describe('SEO robots configuration', () => {
    it('should allow indexing', () => {
      expect(metadata.robots).toBeDefined();
      expect((metadata.robots as any).index).toBe(true);
      expect((metadata.robots as any).follow).toBe(true);
    });

    it('should have googleBot configuration', () => {
      const robots = metadata.robots as any;
      expect(robots.googleBot).toBeDefined();
      expect(robots.googleBot.index).toBe(true);
      expect(robots.googleBot['max-image-preview']).toBe('large');
    });
  });

  describe('Open Graph metadata', () => {
    it('should have Open Graph configuration', () => {
      expect(metadata.openGraph).toBeDefined();
    });

    it('should have correct Open Graph type', () => {
      expect((metadata.openGraph as any).type).toBe('website');
    });

    it('should have correct Open Graph locale', () => {
      expect((metadata.openGraph as any).locale).toBe('en_US');
    });

    it('should have Open Graph title and description', () => {
      expect((metadata.openGraph as any).title).toBe(
        'Gatewayz - One Interface To Work With Any LLM'
      );
      expect((metadata.openGraph as any).description).toBe(
        'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.'
      );
    });

    it('should have Open Graph image configured', () => {
      const images = (metadata.openGraph as any).images;
      expect(images).toBeDefined();
      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBeGreaterThan(0);
    });

    it('should have correct Open Graph image properties', () => {
      const image = (metadata.openGraph as any).images[0];
      expect(image.url).toBe('/og-image.png');
      expect(image.width).toBe(1200);
      expect(image.height).toBe(630);
      expect(image.alt).toBe('Gatewayz - One Interface To Work With Any LLM');
      expect(image.type).toBe('image/png');
    });

    it('should have correct site name', () => {
      expect((metadata.openGraph as any).siteName).toBe('Gatewayz');
    });

    it('should have correct URL', () => {
      expect((metadata.openGraph as any).url).toBe('https://beta.gatewayz.ai');
    });
  });

  describe('Twitter Card metadata', () => {
    it('should have Twitter configuration', () => {
      expect(metadata.twitter).toBeDefined();
    });

    it('should use summary_large_image card type', () => {
      expect((metadata.twitter as any).card).toBe('summary_large_image');
    });

    it('should have Twitter title and description', () => {
      expect((metadata.twitter as any).title).toBe(
        'Gatewayz - One Interface To Work With Any LLM'
      );
      expect((metadata.twitter as any).description).toBe(
        'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.'
      );
    });

    it('should have Twitter image configured', () => {
      const images = (metadata.twitter as any).images;
      expect(images).toBeDefined();
      expect(images).toContain('/og-image.png');
    });

    it('should have creator handle', () => {
      expect((metadata.twitter as any).creator).toBe('@gatewayz_ai');
    });
  });

  describe('Icons configuration', () => {
    it('should have favicon configured', () => {
      expect(metadata.icons).toBeDefined();
      expect((metadata.icons as any).icon).toBeDefined();
    });

    it('should have multiple favicon sizes', () => {
      const icons = (metadata.icons as any).icon;
      expect(Array.isArray(icons)).toBe(true);
      expect(icons.length).toBeGreaterThanOrEqual(3);
    });

    it('should have apple touch icon', () => {
      const appleIcons = (metadata.icons as any).apple;
      expect(appleIcons).toBeDefined();
      expect(appleIcons[0].url).toBe('/apple-touch-icon.png');
    });
  });

  describe('Metadata base URL', () => {
    it('should have metadataBase configured', () => {
      expect(metadata.metadataBase).toBeDefined();
      expect(metadata.metadataBase?.toString()).toBe('https://beta.gatewayz.ai/');
    });
  });
});
