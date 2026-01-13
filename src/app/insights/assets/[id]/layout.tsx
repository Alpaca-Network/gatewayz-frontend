import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function AssetLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
