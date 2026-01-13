import AssetPageClient from './asset-page-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AssetSummaryPage({ params }: PageProps) {
  return <AssetPageClient params={params} />;
}
