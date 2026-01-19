"use client";

import { useStorageStatus } from "@/components/providers/privy-provider";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

export default function TestStorageContextPage() {
  const storageStatus = useStorageStatus();
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const [timeline, setTimeline] = useState<Array<{ time: number; storageStatus: string; authLoading: boolean }>>([]);

  useEffect(() => {
    setTimeline((prev) => [
      ...prev,
      {
        time: Date.now(),
        storageStatus,
        authLoading,
      },
    ]);
  }, [storageStatus, authLoading]);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Storage Context Fix Verification</h1>

      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="font-medium min-w-[180px]">Storage Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${storageStatus === "ready" ? "bg-green-100 text-green-800" : storageStatus === "checking" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                {storageStatus}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium min-w-[180px]">Auth Loading:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${authLoading ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                {authLoading ? "true" : "false"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Expected Behavior</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Storage Status should transition from checking to ready</li>
            <li>Auth Loading should transition from true to false</li>
            <li>The page should NOT get stuck in loading state</li>
          </ol>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <div className="space-y-2 font-mono text-xs">
            {timeline.map((entry, i) => (
              <div key={i} className="flex gap-4 py-1">
                <span className="text-gray-500">{i === 0 ? "0ms" : `${entry.time - timeline[0].time}ms`}</span>
                <span>storage: {entry.storageStatus}</span>
                <span>authLoading: {String(entry.authLoading)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
