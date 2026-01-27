import type { Metadata } from 'next';

export const redbeardMetadata: Metadata = {
  title: 'Red Beard Ventures Partnership | Gatewayz',
  description: 'Gatewayz x Red Beard Ventures - Strategic Partnership Announcement',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.gatewayz.ai/redbeard',
    siteName: 'Gatewayz',
    title: 'Gatewayz x Red Beard Ventures - Strategic Partnership',
    description: 'Gatewayz x Red Beard Ventures - Strategic Partnership Announcement',
    images: [
      {
        url: '/redbeard-og-image.png',
        width: 1200,
        height: 630,
        alt: 'Gatewayz x Red Beard Ventures - Strategic Partnership Announcement',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gatewayz x Red Beard Ventures - Strategic Partnership',
    description: 'Gatewayz x Red Beard Ventures - Strategic Partnership Announcement',
    images: ['/redbeard-og-image.png'],
    creator: '@gatewayz_ai',
  },
};
