/**
 * Organization JSON-LD for beta.gatewayz.ai.
 *
 * Mirrors the Organization node www.gatewayz.ai emits (same name, url, logo,
 * description and sameAs) so search engines see one organisation, not two.
 * `url` points at the apex because that is the organisation's home; beta is
 * declared through sameAs. Keep these values in step with www — if www adds an
 * `@id`, add the identical one here.
 */
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Gatewayz',
  description:
    'Gatewayz is the inference layer for the agentic economy: one model-agnostic endpoint that AI agents run on, built for callers with no human in the loop.',
  url: 'https://www.gatewayz.ai',
  logo: 'https://www.gatewayz.ai/android-chrome-512x512.png',
  sameAs: [
    'https://beta.gatewayz.ai',
    'https://x.com/GatewayzAI',
    'https://www.linkedin.com/company/gatewayz-ai/',
  ],
} as const;

export function OrganizationSchema() {
  return (
    <script
      type="application/ld+json"
      // Content is a compile-time constant, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
    />
  );
}
