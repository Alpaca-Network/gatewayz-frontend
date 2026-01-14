import AssetPageClient from './asset-page-client';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since asset IDs are dynamic and loaded from API.
 * For static export (desktop builds), this route won't be pre-rendered.
 * For server mode (web), dynamic routing still works normally.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AssetSummaryPage({ params }: PageProps) {
  return <AssetPageClient params={params} />;
}
