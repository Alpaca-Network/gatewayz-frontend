"use client";

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import Link from 'next/link';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();

  useEffect(() => {
    // Redirect authenticated users to chat or the specified redirect URL
    if (ready && authenticated) {
      const redirect = searchParams?.get('redirect') || '/chat';
      router.push(redirect);
    }
  }, [ready, authenticated, router, searchParams]);

  const handleLogin = () => {
    if (!ready) {
      return;
    }

    if (authenticated) {
      const redirect = searchParams?.get('redirect') || '/chat';
      router.push(redirect);
      return;
    }

    login();
  };

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription className="text-base">
            Sign in to continue to Gatewayz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={!ready || authenticated}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Your account includes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Access to 10,000+ AI models
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Your saved chat sessions
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Advanced AI routing & analytics
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
