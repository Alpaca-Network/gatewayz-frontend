"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, ArrowRight, Code, MessageSquare, CreditCard, Sparkles, Terminal, Book, Copy, Check, Key } from "lucide-react";
import Link from "next/link";
import { getUserData, getApiKey } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: string;
  actionLabel?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);

  const [tasks, setTasks] = useState<OnboardingTask[]>([
    {
      id: "welcome",
      title: "Welcome to Gatewayz",
      description: "You're all set! You have $10 in free credits to get started.",
      icon: <Sparkles className="h-5 w-5" />,
      completed: true,
    },
    {
      id: "chat",
      title: "Start Your First Chat",
      description: "Try chatting with any of our AI models in the playground.",
      icon: <MessageSquare className="h-5 w-5" />,
      completed: false,
      action: "/chat",
      actionLabel: "Go to Chat"
    },
    {
      id: "explore",
      title: "Explore 10,000+ AI Models",
      description: "Browse our model catalog and see integration examples below.",
      icon: <Book className="h-5 w-5" />,
      completed: false,
      action: "/models",
      actionLabel: "Browse Models"
    },
    {
      id: "credits",
      title: "Add More Credits (Optional)",
      description: "When you're ready, add more credits to keep using AI models.",
      icon: <CreditCard className="h-5 w-5" />,
      completed: false,
      action: "/settings/credits",
      actionLabel: "View Credits"
    },
  ]);

  const [showBanner, setShowBanner] = useState(true);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4');
  const [copiedCode, setCopiedCode] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([
    { id: 'openai/gpt-4', name: 'GPT-4' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
    { id: 'google/gemini-pro', name: 'Gemini Pro' },
    { id: 'meta-llama/llama-3-70b', name: 'Llama 3 70B' },
    { id: 'mistralai/mistral-large', name: 'Mistral Large' },
  ]);

  useEffect(() => {
    // Check if user has already seen onboarding
    const hasSeenOnboarding = localStorage.getItem('gatewayz_onboarding_completed');
    if (hasSeenOnboarding) {
      // Redirect to chat if they've already completed onboarding
      router.push('/chat');
    }

    // Load API key
    const key = getApiKey();
    if (key) {
      setApiKey(key);
    }

    // Load completed tasks from localStorage
    const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks);
      setTasks(prev => prev.map(task => ({
        ...task,
        completed: parsedTasks[task.id] || task.completed
      })));
    }

    // Auto-mark first task as complete
    const userData = getUserData();
    if (userData) {
      markTaskComplete('welcome');
    }

    // Fetch top models from rankings endpoint
    const fetchTopModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/ranking/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const result = await response.json();
          // Get top 5 models from "Top this month"
          const topModels = result.data
            .filter((model: any) => model.time_period === 'Top this month')
            .sort((a: any, b: any) => a.rank - b.rank)
            .slice(0, 5)
            .map((model: any) => ({
              id: model.model_name,
              name: model.model_name
            }));

          if (topModels.length > 0) {
            setModels(topModels);
            setSelectedModel(topModels[0].id);
          }
        }
      } catch (error) {
        console.log('Failed to fetch top models:', error);
        // Keep fallback models
      }
    };

    fetchTopModels();
  }, [router]);

  const markTaskComplete = (taskId: string) => {
    setTasks(prev => {
      const updated = prev.map(task =>
        task.id === taskId ? { ...task, completed: true } : task
      );

      // Save to localStorage
      const taskState: Record<string, boolean> = {};
      updated.forEach(task => {
        taskState[task.id] = task.completed;
      });
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));

      return updated;
    });
  };

  const toggleTaskComplete = (taskId: string) => {
    setTasks(prev => {
      const updated = prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );

      // Save to localStorage
      const taskState: Record<string, boolean> = {};
      updated.forEach(task => {
        taskState[task.id] = task.completed;
      });
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));

      return updated;
    });
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getCodeExample = (language: 'curl' | 'python' | 'javascript') => {
    const examples = {
      curl: `curl -X POST https://api.gatewayz.ai/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
      python: `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey || 'YOUR_API_KEY'}",
    base_url="https://api.gatewayz.ai/v1"
)

response = client.chat.completions.create(
    model="${selectedModel}",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,
      javascript: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: "${apiKey || 'YOUR_API_KEY'}",
  baseURL: "https://api.gatewayz.ai/v1"
});

const response = await client.chat.completions.create({
  model: "${selectedModel}",
  messages: [{ role: "user", content: "Hello!" }]
});

console.log(response.choices[0].message.content);`
    };
    return examples[language];
  };

  const handleFinishOnboarding = () => {
    localStorage.setItem('gatewayz_onboarding_completed', 'true');
    router.push('/chat');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Top Banner for SDK and Claude Code */}
      {showBanner && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 flex-1">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  <span className="font-semibold">Developers:</span>
                </div>
                <Link
                  href="https://github.com/Alpaca-Network/gatewayz-python"
                  target="_blank"
                  className="flex items-center gap-2 hover:underline transition-all"
                >
                  <Code className="h-4 w-4" />
                  <span className="text-sm">Install SDK</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/claude-code"
                  className="flex items-center gap-2 hover:underline transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm">Try Claude Code</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBanner(false)}
                className="text-white hover:bg-white/20"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Onboarding Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to Gatewayz! 🎉</h1>
          <p className="text-xl text-muted-foreground mb-2">
            Let's get you started with a few quick tasks
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <span className="font-medium">{completedCount} of {totalCount} completed</span>
            <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* API Key Display */}
          {apiKey && (
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5 text-purple-600" />
                  Your API Key
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
                  <code className="flex-1 truncate">{apiKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyApiKey}
                    className="shrink-0"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="h-4 w-4 mr-1 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this key to authenticate API requests
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Task List */}
        <div className="space-y-4 mb-8">
          {tasks.map((task, index) => (
            <Card
              key={task.id}
              className={`transition-all duration-300 ${
                task.completed
                  ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                  : 'hover:shadow-lg hover:scale-[1.01]'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className={`mt-1 hover:scale-110 transition-transform ${task.completed ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>
                    <div className="flex-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {task.icon}
                        {task.title}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {task.description}
                      </CardDescription>
                    </div>
                  </div>
                  {task.action && (
                    <Link href={task.action}>
                      <Button
                        variant={task.completed ? "outline" : "default"}
                        size="sm"
                        onClick={() => !task.completed && markTaskComplete(task.id)}
                      >
                        {task.actionLabel}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Integration Code Examples */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Integration Examples</CardTitle>
            <CardDescription>Call any model with a few lines of code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Model Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select a model:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  {models.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>

              {/* Code Examples Tabs */}
              <div className="space-y-4">
                {/* cURL Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">cURL</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(getCodeExample('curl'))}
                    >
                      {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                    <code>{getCodeExample('curl')}</code>
                  </pre>
                </div>

                {/* Python Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Python</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(getCodeExample('python'))}
                    >
                      {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                    <code>{getCodeExample('python')}</code>
                  </pre>
                </div>

                {/* JavaScript Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">JavaScript / TypeScript</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(getCodeExample('javascript'))}
                    >
                      {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                    <code>{getCodeExample('javascript')}</code>
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Resources</CardTitle>
            <CardDescription>Everything you need to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="https://docs.gatewayz.ai"
                target="_blank"
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Book className="h-5 w-5 mb-2 text-blue-600" />
                <h3 className="font-semibold mb-1">Documentation</h3>
                <p className="text-sm text-muted-foreground">Learn how to use the platform</p>
              </Link>
              <Link
                href="https://github.com/Alpaca-Network/gatewayz-python"
                target="_blank"
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Code className="h-5 w-5 mb-2 text-purple-600" />
                <h3 className="font-semibold mb-1">SDK Installation</h3>
                <p className="text-sm text-muted-foreground">Integrate with your code</p>
              </Link>
              <Link
                href="/claude-code"
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Terminal className="h-5 w-5 mb-2 text-green-600" />
                <h3 className="font-semibold mb-1">Claude Code</h3>
                <p className="text-sm text-muted-foreground">AI-powered coding assistant</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/models')}
          >
            Browse Models
          </Button>
          <Button
            size="lg"
            onClick={handleFinishOnboarding}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            Start Chatting
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Skip Option */}
        <div className="text-center mt-6">
          <button
            onClick={handleFinishOnboarding}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Skip onboarding and go to chat
          </button>
        </div>
      </div>
    </div>
  );
}
