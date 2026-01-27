"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { Code2, Terminal, MessageSquare, ChevronDown } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import posthog from 'posthog-js';
import { safeLocalStorageSet } from '@/lib/safe-storage';

interface PathChooserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PathChooserModal({ open, onOpenChange }: PathChooserModalProps) {
  const router = useRouter();
  const { user, login } = usePrivy();

  const handlePathSelect = (path: 'api' | 'claude-code' | 'opencode' | 'chat') => {
    // Track path selection
    posthog.capture('path_selected', { path });

    if (!user && (path === 'api' || path === 'claude-code' || path === 'opencode')) {
      // For API, Claude Code, and OpenCode, require auth first
      login();
      // Store the intended path in localStorage to redirect after auth
      safeLocalStorageSet('onboarding_path', path);
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

          {/* Terminal Coding Agents Path */}
          <div className="group flex flex-col items-center p-6 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all text-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Terminal className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Terminal Coding Agent</h3>
            <p className="text-sm text-muted-foreground mb-4">
              One command → AI-powered coding in minutes
            </p>
            <div className="mt-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="group-hover:bg-purple-500 group-hover:text-white group-hover:border-purple-500">
                    Get Started
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem
                    onClick={() => handlePathSelect('claude-code')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor"/>
                        </svg>
                      </div>
                      <span>Claude Code</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handlePathSelect('opencode')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span>OpenCode</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

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
