import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from '@/components/layout/app-header';
import { AppFooter } from '@/components/layout/app-footer';
import { ThemeProvider } from '@/components/theme-provider';
import { PrivyProviderWrapper } from '@/components/providers/privy-provider';
import { OnboardingBanner } from '@/components/onboarding/onboarding-banner';
import { WelcomeDialog } from '@/components/dialogs/welcome-dialog';
import { TrialCreditsNotice } from '@/components/dialogs/trial-credits-notice';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter } from 'next/font/google';
// import { GTMLoader } from '@/components/analytics/gtm-loader'; // Temporarily disabled due to layout router issues

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden h-full">
      <body className={`${inter.className} antialiased bg-background min-h-screen flex flex-col`} suppressHydrationWarning>
        <ThemeProvider
          defaultTheme="system"
          storageKey="ui-theme"
        >
          <PrivyProviderWrapper className="flex flex-col min-h-screen">
            {/* <GTMLoader /> Temporarily disabled due to layout router issues */}
            <AppHeader />
            <OnboardingBanner />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            <Toaster />
            <AppFooter />
            <WelcomeDialog />
            <TrialCreditsNotice />
            <Analytics />
            <SpeedInsights />
          </PrivyProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
