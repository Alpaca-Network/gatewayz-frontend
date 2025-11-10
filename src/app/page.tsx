
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowRight, ChevronRight, GitMerge, ShieldCheck, TrendingUp, User, Zap, Code2, Terminal, MessageSquare, Check as CheckIcon, Send } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getApiKey } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import Image from 'next/image';
import { PathChooserModal } from '@/components/onboarding/path-chooser-modal';
import posthog from 'posthog-js';
import {CodeExample} from "@/components/sections/CodeExample";
import TitleSection from "@/components/sections/TitleSection";
import LogoMarquee from "@/components/sections/LogoMarquee";
import HowItWorks from "@/components/sections/HowItWorks";
import Benefits from "@/components/sections/Benefits";
import {FeaturesModern} from "@/components/sections/FeaturesModern";
import ProblemSolution from "@/components/sections/ProblemSolution";
import FAQ from "@/components/sections/FAQ";

interface FeaturedModel {
  name: string;
  by: string;
  tokens: string;
  latency: string;
  growth: string;
  color: string;
  logo_url?: string;
}

interface RankingModelData {
  id: number;
  rank: number;
  model_name: string;
  author: string;
  tokens: string;
  trend_percentage: string;
  trend_direction: "up" | "down";
  trend_icon: string;
  trend_color: string;
  model_url: string;
  author_url: string;
  time_period: string;
  scraped_at: string;
  logo_url: string;
}

export default function Home() {
  const [activeModelIndex, setActiveModelIndex] = useState<number | null>(0);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { user, ready, login } = usePrivy();
  const [apiKey, setApiKey] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselOffset, setCarouselOffset] = useState(0);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'javascript' | 'curl'>('python');
  const [codeCopied, setCodeCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(true);
  const { toast } = useToast();
  const [showPathChooser, setShowPathChooser] = useState(false);

  // Load the actual API key when user is authenticated
  useEffect(() => {
    const loadApiKey = () => {
      // Wait for Privy to be ready
      if (!ready) {
        return;
      }

      if (user) {
        const userApiKey = getApiKey();
        if (userApiKey) {
          setApiKey(userApiKey);
        } else {
          // User is authenticated but no API key yet - show placeholder
          setApiKey('');
        }
      } else {
        setApiKey(''); // Show placeholder when not authenticated
      }
    };

    // Load initially
    loadApiKey();

    // Listen for storage changes (in case API key is set in another component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gatewayz_api_key') {
        loadApiKey();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Poll for changes every 5 seconds to catch same-tab updates (reduced from 1s for performance)
    const interval = setInterval(loadApiKey, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, ready]);

  // Dynamic code examples with actual API key
  const codeExamples = {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.gatewayz.ai/v1",
    api_key="${apiKey || 'YOUR_API_KEY'}"
)

completion = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(completion.choices[0].message)`,

    javascript: `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.gatewayz.ai/v1",
  apiKey: "${apiKey || 'YOUR_API_KEY'}",
});

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "user", content: "Hello!" }
  ],
});

console.log(completion.choices[0].message);`,

    curl: `curl https://api.gatewayz.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'`
  };
  const [featuredModels, setFeaturedModels] = useState<FeaturedModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // Fetch models from rankings API
  useEffect(() => {
    const fetchRankingModels = async () => {
      try {
        setIsLoadingModels(true);
        const response = await fetch(`${API_BASE_URL}/ranking/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const result = await response.json();
          const rankingModels: RankingModelData[] = result.data || [];

          // Map ranking data to featured model format
          const mappedModels: FeaturedModel[] = rankingModels.slice(0, 10).map((model) => {
            // Get logo based on author
            const authorLower = model.author.toLowerCase();
            let logo_url = '/logo_black.svg'; // Default logo

            if (authorLower.includes('google')) {
              logo_url = '/Google_Logo-black.svg';
            } else if (authorLower.includes('openai')) {
              logo_url = '/OpenAI_Logo-black.svg';
            } else if (authorLower.includes('anthropic')) {
              logo_url = '/anthropic-logo.svg';
            } else if (authorLower.includes('meta')) {
              logo_url = '/Meta_Logo-black.svg';
            } else if (authorLower.includes('deepseek')) {
              logo_url = '/deepseek-icon.svg';
            } else if (authorLower.includes('x-ai') || authorLower.includes('xai')) {
              logo_url = '/xai-logo.svg';
            }

            // Format growth percentage
            const growth = model.trend_direction === 'up'
              ? `+${model.trend_percentage}`
              : model.trend_direction === 'down'
                ? `-${model.trend_percentage}`
                : model.trend_percentage;

            return {
              name: model.model_name,
              by: model.author,
              tokens: model.tokens,
              latency: '--', // Not provided by ranking API
              growth: growth,
              color: model.trend_direction === 'up' ? 'bg-green-400' : model.trend_direction === 'down' ? 'bg-red-400' : 'bg-gray-400',
              logo_url: logo_url
            };
          });

          setFeaturedModels(mappedModels);
        } else {
          console.error('Failed to fetch ranking models');
          // Set fallback models if API fails
          setFeaturedModels([
            { name: 'Gemini 2.5 Pro', by: 'google', tokens: '170.06', latency: '2.6s', growth: '+13.06%', color: 'bg-blue-400', logo_url: '/Google_Logo-black.svg' },
            { name: 'GPT-4', by: 'openai', tokens: '20.98', latency: '850ms', growth: '--', color: 'bg-green-400', logo_url: '/OpenAI_Logo-black.svg' },
            { name: 'Claude Sonnet 4', by: 'anthropic', tokens: '585.26', latency: '1.9s', growth: '-9.04%', color: 'bg-purple-400', logo_url: '/anthropic-logo.svg' }
          ]);
        }
      } catch (error) {
        console.error('Error fetching ranking models:', error);
        // Set fallback models on error
        setFeaturedModels([
          { name: 'Gemini 2.5 Pro', by: 'google', tokens: '170.06', latency: '2.6s', growth: '+13.06%', color: 'bg-blue-400', logo_url: '/Google_Logo-black.svg' },
          { name: 'GPT-4', by: 'openai', tokens: '20.98', latency: '850ms', growth: '--', color: 'bg-green-400', logo_url: '/OpenAI_Logo-black.svg' },
          { name: 'Claude Sonnet 4', by: 'anthropic', tokens: '585.26', latency: '1.9s', growth: '-9.04%', color: 'bg-purple-400', logo_url: '/anthropic-logo.svg' }
        ]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchRankingModels();
  }, []);

  // Auto-advance carousel every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveModelIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % featuredModels.length;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [featuredModels.length]);

  // Double the models array for infinite scrolling
  const displayModels = [...featuredModels, ...featuredModels];

  // Calculate offset - just measure collapsed card widths, not the expanded one
  useEffect(() => {
    const updateOffset = () => {
      if (carouselRef.current && activeModelIndex !== null) {
        // Assume compact cards are ~96px on desktop, ~80px on mobile
        // Expanded card is ~400px on desktop, ~280px on mobile
        const compactWidth = window.innerWidth >= 640 ? 96 : 80;
        const gap = 8;

        // Calculate offset: number of cards before active * (compact width + gap)
        const offset = activeModelIndex * (compactWidth + gap);

        setCarouselOffset(-offset);
      }
    };

    updateOffset();
    const timer = setTimeout(updateOffset, 100);

    return () => clearTimeout(timer);
  }, [activeModelIndex]);

  const handleModelClick = (index: number) => {
    setActiveModelIndex(index);
  };

  const handleSendMessage = () => {
    if (message.trim() && activeModelIndex !== null) {
      const selectedModel = featuredModels[activeModelIndex];
      // Navigate to chat page with the selected model
      router.push(`/chat?model=${encodeURIComponent(selectedModel.name)}&message=${encodeURIComponent(message)}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({
        title: "API Key Copied",
        description: "Your API key has been copied to clipboard.",
      });
    }
  };

  const handleGenerateApiKey = () => {
    if (user) {
      // If already logged in, redirect to credits page to claim trial
      router.push('/settings/credits');
    } else {
      // If not logged in, trigger login
      login();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeExamples[activeCodeTab]);
    setCodeCopied(true);
    toast({
      title: "Code copied!",
      description: "The code has been copied to your clipboard.",
    });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Track page view on mount
  useEffect(() => {
    posthog.capture('view_homepage');
  }, []);

  return (
    <div className="bg-background text-foreground w-full overflow-x-hidden overflow-y-auto h-full">
      {/* Claude Code Integration Banner - Commented out in master */}
      {/*<div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md overflow-hidden">*/}
      {/*  <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4">*/}
      {/*    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">*/}
      {/*      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">*/}
      {/*        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 flex-shrink-0">*/}
      {/*          <svg className="w-4 h-4 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">*/}
      {/*            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor"/>*/}
      {/*          </svg>*/}
      {/*        </div>*/}
      {/*        <div className="flex-1 min-w-0">*/}
      {/*          <p className="font-semibold text-xs sm:text-base leading-tight">*/}
      {/*            🚀 New: Integrate Claude Code with Gatewayz API*/}
      {/*          </p>*/}
      {/*          <p className="text-[11px] sm:text-sm text-white/90 leading-tight mt-0.5">*/}
      {/*            Access multiple AI models, save costs, and build faster*/}
      {/*          </p>*/}
      {/*        </div>*/}
      {/*      </div>*/}
      {/*      <Link href="/start/claude-code" className="w-full sm:w-auto flex-shrink-0">*/}
      {/*        <Button*/}
      {/*          variant="secondary"*/}
      {/*          size="sm"*/}
      {/*          className="bg-background text-purple-600 dark:text-purple-400 hover:bg-muted whitespace-nowrap w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2"*/}
      {/*          onClick={() => posthog.capture('claude_code_banner_clicked')}*/}
      {/*        >*/}
      {/*          Get Started →*/}
      {/*        </Button>*/}
      {/*      </Link>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}

      <main className="w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8" style={{position: 'relative'}}>
          {/* Hero Section */}
          <Image
            src="/logo_transparent.svg"
            alt="Background logo"
            width={768}
            height={768}
            priority
            className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[180px] h-[180px] sm:w-[350px] sm:h-[350px] md:w-[450px] md:h-[450px] lg:w-[640px] lg:h-[640px] xl:w-[768px] xl:h-[768px] pointer-events-none opacity-20 sm:opacity-50 md:opacity-100"
            style={{ zIndex: 0 }}
          />

          <section className="pt-8 sm:pt-16 md:pt-24 lg:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-5xl mx-auto px-2 sm:px-3 md:px-4 relative min-h-auto sm:min-h-[80vh]" style={{ zIndex: 1 }}>
            <TitleSection/>

            <PathChooserModal open={showPathChooser} onOpenChange={setShowPathChooser} />

            {/* Three Path Cards - Above the Fold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4 sm:gap-5 md:gap-6 mt-6 xs:mt-8 sm:mt-10 md:mt-12 mb-6 xs:mb-8 sm:mb-10 md:mb-12">
            {/* API Path Card */}
            <Link href="/start/api" className="group">
              <div className="bg-card border-2 border-border hover:border-blue-500 rounded-lg p-3 xs:p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                {/* Mobile: Icon + Title + Get Started on one line */}
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
                  <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Code2 className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm xs:text-base sm:text-xl font-bold flex-grow">Use the API</h3>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline flex-shrink-0 sm:hidden">
                    Get Started →
                  </div>
                </div>

                {/* Description - hidden on mobile, visible on larger screens */}
                <p className="hidden sm:block text-sm text-muted-foreground mb-4 mt-4 flex-grow leading-relaxed">
                  Copy key → make your first API call in 30 seconds
                </p>

                {/* Get Started - only visible on larger screens */}
                <div className="hidden sm:block mt-auto">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                    Get Started →
                  </div>
                </div>
              </div>
            </Link>

            {/* Claude Code Path Card */}
            <Link href="/start/claude-code" className="group">
              <div className="bg-card border-2 border-border hover:border-purple-500 rounded-lg p-3 xs:p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                {/* Mobile: Icon + Title + Get Started on one line */}
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
                  <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Terminal className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm xs:text-base sm:text-xl font-bold flex-grow">Install Claude Code</h3>
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:underline flex-shrink-0 sm:hidden">
                    Get Started →
                  </div>
                </div>

                {/* Description - hidden on mobile, visible on larger screens */}
                <p className="hidden sm:block text-sm text-muted-foreground mb-4 mt-4 flex-grow leading-relaxed">
                  One command → AI-powered coding in minutes
                </p>

                {/* Get Started - only visible on larger screens */}
                <div className="hidden sm:block mt-auto">
                  <div className="text-sm font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
                    Get Started →
                  </div>
                </div>
              </div>
            </Link>

            {/* Chat Path Card */}
            <Link href="/start/chat" className="group sm:col-span-2 md:col-span-1">
              <div className="bg-card border-2 border-border hover:border-green-500 rounded-lg p-3 xs:p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                {/* Mobile: Icon + Title + Get Started on one line */}
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
                  <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-sm xs:text-base sm:text-xl font-bold flex-grow">Open Chat</h3>
                  <div className="text-xs font-medium text-green-600 dark:text-green-400 group-hover:underline flex-shrink-0 sm:hidden">
                    Get Started →
                  </div>
                </div>

                {/* Description - hidden on mobile, visible on larger screens */}
                <p className="hidden sm:block text-sm text-muted-foreground mb-4 mt-4 flex-grow leading-relaxed">
                  Start chatting → we pick the best model for you
                </p>

                {/* Get Started - only visible on larger screens */}
                <div className="hidden sm:block mt-auto">
                  <div className="text-sm font-medium text-green-600 dark:text-green-400 group-hover:underline">
                    Get Started →
                  </div>
                </div>
              </div>
            </Link>
          </div>
          </section>

          <div className="my-12 w-full animate-fade-in opacity-0 delay-400">
            <LogoMarquee />
          </div>

          <CodeExample/>

          <HowItWorks/>

          <FeaturesModern/>

          <ProblemSolution/>

          {/*<Benefits/>*/}

          <FAQ/>
        </div>
      </main>

    </div>
  );
}
