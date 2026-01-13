import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Gatewayz - One Interface To Work With Any LLM',
  description: 'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.',
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai',
    siteName: 'Gatewayz',
    title: 'Gatewayz - One Interface To Work With Any LLM',
    description: 'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Gatewayz - One Interface To Work With Any LLM',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gatewayz - One Interface To Work With Any LLM',
    description: 'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.',
    images: ['/og-image.png'],
    creator: '@gatewayz_ai',
  },
};
