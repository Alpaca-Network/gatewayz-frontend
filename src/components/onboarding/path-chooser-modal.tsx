"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Code2, Terminal, MessageSquare } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import posthog from 'posthog-js';

interface PathChooserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PathChooserModal({ open, onOpenChange }: PathChooserModalProps) {
  const router = useRouter();
  const { user, login } = usePrivy();

  const handlePathSelect = (path: 'api' | 'claude-code' | 'chat') => {
    // Track path selection
    posthog.capture('path_selected', { path });

    if (!user && (path === 'api' || path === 'claude-code')) {
      // For API and Claude Code, require auth first
      login();
      // Store the intended path in localStorage to redirect after auth
      localStorage.setItem('onboarding_path', path);
      onOpenChange(false);
    } else {
      // Navigate to the selected path
      router.push(`/start/${path}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Choose Your Path</DialogTitle>
          <DialogDescription className="text-center text-base">
            How do you want to get started with Gatewayz?
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {/* API Path */}
          <button
            onClick={() => handlePathSelect('api')}
            className="group flex flex-col items-center p-6 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all text-center"
          >
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Code2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Use the API</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Copy your API key → make your first call in 30 seconds
            </p>
            <div className="mt-auto">
              <Button variant="outline" size="sm" className="group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500">
                Get Started
              </Button>
            </div>
          </button>

          {/* Claude Code Path */}
          <button
            onClick={() => handlePathSelect('claude-code')}
            className="group flex flex-col items-center p-6 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all text-center"
          >
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Terminal className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Install Claude Code</h3>
            <p className="text-sm text-muted-foreground mb-4">
              One command → AI-powered coding in minutes
            </p>
            <div className="mt-auto">
              <Button variant="outline" size="sm" className="group-hover:bg-purple-500 group-hover:text-white group-hover:border-purple-500">
                Get Started
              </Button>
            </div>
          </button>

          {/* Chat Path */}
          <button
            onClick={() => handlePathSelect('chat')}
            className="group flex flex-col items-center p-6 border-2 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Open Chat</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start chatting → we pick the best model for you
            </p>
            <div className="mt-auto">
              <Button variant="outline" size="sm" className="group-hover:bg-green-500 group-hover:text-white group-hover:border-green-500">
                Get Started
              </Button>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
