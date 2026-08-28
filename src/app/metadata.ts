import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

/**
 * FR-A6.5 — entity unification with the apex domain.
 *
 * beta and www previously described the same brand two different ways
 * ("One Interface To Work With Any LLM" here, "One API for Any AI Model"
 * there), with no canonical on either side. Search engines were left to pick
 * a winner for brand queries — PRD risk R7. Both now use the canonical
 * positioning from FR-A6.1.
 *
 * `alternates.canonical` is self-referencing here because this is the app, not
 * a duplicate of the marketing site. Any page that genuinely duplicates apex
 * content should instead canonical to the apex URL.
 */
export const metadata: Metadata = {
  title: 'Gatewayz — One API for Every AI Model | AI Inference Router',
  description: 'One OpenAI-compatible API for every major AI model. Route across providers with a single key, one bill, and transparent per-token pricing.',
  keywords: ['AI', 'LLM', 'GPT', 'Claude', 'Gemini', 'API Gateway', 'AI Router', 'Model Routing'],
  authors: [{ name: 'Gatewayz' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  metadataBase: new URL('https://beta.gatewayz.ai'),
  alternates: {
    canonical: 'https://beta.gatewayz.ai',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai',
    siteName: 'Gatewayz',
    title: 'Gatewayz — One API for Every AI Model | AI Inference Router',
    description: 'One OpenAI-compatible API for every major AI model. Route across providers with a single key, one bill, and transparent per-token pricing.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Gatewayz — one API for every AI model',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gatewayz — One API for Every AI Model | AI Inference Router',
    description: 'One OpenAI-compatible API for every major AI model. Route across providers with a single key, one bill, and transparent per-token pricing.',
    images: ['/og-image.png'],
    creator: '@GatewayzAI',
    site: '@GatewayzAI',
  },
};
