"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Code2, Calculator, Sparkles } from 'lucide-react';
import { FEATURED_MODELS } from '@/lib/config';

export default function StartChatPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  // Track page view
  useEffect(() => {
    posthog.capture('view_start_chat');
  }, []);

  const handleQuickStart = (prompt: string, model: string) => {
    posthog.capture('first_chat_sent', { quick_start: true, model });
    router.push(`/chat?message=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}`);
  };

  const handleCustomMessage = () => {
    if (message.trim()) {
      posthog.capture('first_chat_sent', { quick_start: false });
      router.push(`/chat?message=${encodeURIComponent(message)}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomMessage();
    }
  };

  const quickStartOptions = [
    {
      icon: <Code2 className="w-6 h-6" />,
      title: "Code",
      description: "Best for programming tasks",
      prompt: "Help me write a Python function to process CSV files",
      model: FEATURED_MODELS.code.id,
      modelDisplayName: FEATURED_MODELS.code.displayName,
      color: "blue",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      hoverBorder: "hover:border-blue-500",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: <Calculator className="w-6 h-6" />,
      title: "Math",
      description: "Best for calculations & reasoning",
      prompt: "Solve this calculus problem: find the derivative of x³ + 2x² - 5x + 3",
      model: FEATURED_MODELS.math.id,
      modelDisplayName: FEATURED_MODELS.math.displayName,
      color: "purple",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-800",
      hoverBorder: "hover:border-purple-500",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "General",
      description: "Best for everyday questions",
      prompt: "What are the key benefits of renewable energy?",
      model: FEATURED_MODELS.general.id,
      modelDisplayName: FEATURED_MODELS.general.displayName,
      color: "green",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      hoverBorder: "hover:border-green-500",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Start Chatting with AI</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ask anything. We'll automatically route your question to the best model for the job.
          </p>
        </div>

        {/* Custom Message Input */}
        <div className="mb-12">
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <label className="text-sm font-medium mb-3 block">Ask a Question</label>
            <div className="relative">
              <Input
                placeholder="Type your question here..."
                className="h-14 pr-14 text-base"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={handleCustomMessage}
                type="button"
              >
                <svg width="40" height="40" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="34" height="34" rx="8" fill="black"/>
                  <path d="M9 23.5V18.346L14.846 17L9 15.654V10.5L24.423 17L9 23.5Z" fill="white"/>
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 We automatically pick the best model based on your question
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-background text-muted-foreground">Or try a quick start</span>
          </div>
        </div>

        {/* Quick Start Options */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Quick Start Examples</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {quickStartOptions.map((option) => (
              <button
                key={option.title}
                onClick={() => handleQuickStart(option.prompt, option.model)}
                className={`${option.bgColor} border-2 ${option.borderColor} ${option.hoverBorder} rounded-lg p-6 text-left transition-all hover:shadow-md`}
              >
                <div className={`${option.iconBg} w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
                  <div className={option.iconColor}>
                    {option.icon}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2">{option.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{option.description}</p>
                <div className="bg-background/50 rounded p-2 text-xs font-mono mb-3 line-clamp-2">
                  "{option.prompt}"
                </div>
                <p className="text-xs text-muted-foreground">
                  Powered by <strong>{option.modelDisplayName}</strong>
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-muted/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-center">How Smart Routing Works</h3>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                1
              </div>
              <p className="text-sm font-medium mb-1">You Ask</p>
              <p className="text-xs text-muted-foreground">Send your question</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                2
              </div>
              <p className="text-sm font-medium mb-1">We Route</p>
              <p className="text-xs text-muted-foreground">AI picks the best model</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                3
              </div>
              <p className="text-sm font-medium mb-1">You Get Results</p>
              <p className="text-xs text-muted-foreground">Optimal answer, every time</p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Want more control? Switch models manually in the chat interface.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/chat')}
          >
            Go to Full Chat Interface
          </Button>
        </div>
      </main>
    </div>
  );
}
