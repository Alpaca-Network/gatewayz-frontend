"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatLayout } from "@/components/chat-v2/ChatLayout";
import { FreeModelsBanner } from "@/components/chat/free-models-banner";
import { useAuth } from "@/hooks/use-auth";
import { getApiKey } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// This page uses the v2 chat architecture (Zustand + React Query)
// located under src/components/chat-v2/.

export default function ChatPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const apiKey = getApiKey();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated and no API key is present
    if (!authLoading && !isAuthenticated && !apiKey) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, apiKey, router]);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner message="Initializing chat..." className="border-none bg-transparent" />
      </div>
    );
  }

  // Prevent rendering if we are about to redirect
  if (!isAuthenticated && !apiKey) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <FreeModelsBanner />
        <ChatLayout />
      </Suspense>
    </div>
  );
}
