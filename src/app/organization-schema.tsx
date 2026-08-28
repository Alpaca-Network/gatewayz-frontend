/**
 * Estate entity graph — FR-A6.2 / FR-E2.
 *
 * The @id values are shared across the estate: www.gatewayz.ai emits the same
 * `https://www.gatewayz.ai/#org` node, and alpacanetwork.ai references it as a
 * subOrganization. Keeping them byte-identical is what lets a search engine
 * merge the two surfaces into one entity instead of treating beta as a
 * separate company (PRD risk R7).
 *
 * `url` deliberately points at the apex, not at beta: this node describes the
 * organisation, and the organisation's home is www.gatewayz.ai. beta is
 * declared through sameAs.
 *
 * sameAs carries verified profiles only (G-3). Crunchbase is omitted until a
 * real profile URL is supplied — PRD §8.1's placeholder handles must never
 * ship, and its own CI rule forbids emitting them.
 */
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.gatewayz.ai/#org',
  name: 'Gatewayz',
  description:
    'Gatewayz is the AI inference router of the open compute economy: one OpenAI-compatible API for every major AI model, built by Alpaca Network, the decentralized AI R&D studio.',
  url: 'https://www.gatewayz.ai',
  logo: 'https://www.gatewayz.ai/logo.png',
  sameAs: [
    'https://beta.gatewayz.ai',
    'https://x.com/GatewayzAI',
    'https://www.linkedin.com/company/gatewayz-ai/',
  ],
  parentOrganization: {
    '@type': 'Organization',
    '@id': 'https://alpacanetwork.ai/#org',
    name: 'Alpaca Network',
    url: 'https://alpacanetwork.ai',
  },
  foundingDate: '2024',
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
