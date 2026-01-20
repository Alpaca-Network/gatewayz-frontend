import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, useRef, useCallback } from "react";
import { Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Popular models to cycle through
const popularModels = [
  "gemini-2.5-pro",
  "gpt-4o",
  "claude-sonnet-4",
  "deepseek-v3",
  "llama-4-maverick",
];

// Base code templates with MODEL_PLACEHOLDER to be replaced
const codeTemplates = {
  curl: [
    `curl https://api.gatewayz.ai/v1/chat/completions \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer YOUR_GATEWAYZ_API_KEY" \\`,
    `  -d '{`,
    `    "model": "MODEL_PLACEHOLDER",`,
    `    "messages": [`,
    `      {`,
    `        "role": "user",`,
    `        "content": "Hello!"`,
    `      }`,
    `    ]`,
    `  }'`,
  ],
  python: [
    `from openai import OpenAI`,
    ``,
    `client = OpenAI(`,
    `    base_url="https://api.gatewayz.ai/v1",`,
    `    api_key="YOUR_GATEWAYZ_API_KEY"`,
    `)`,
    ``,
    `response = client.chat.completions.create(`,
    `    model="MODEL_PLACEHOLDER",`,
    `    messages=[`,
    `        {"role": "user", "content": "Hello!"}`,
    `    ]`,
    `)`,
    ``,
    `print(response.choices[0].message.content)`,
  ],
  javascript: [
    `import OpenAI from "openai";`,
    ``,
    `const client = new OpenAI({`,
    `  baseURL: "https://api.gatewayz.ai/v1",`,
    `  apiKey: "YOUR_GATEWAYZ_API_KEY",`,
    `});`,
    ``,
    `const response = await client.chat.completions.create({`,
    `  model: "MODEL_PLACEHOLDER",`,
    `  messages: [`,
    `    { role: "user", content: "Hello!" }`,
    `  ],`,
    `});`,
    ``,
    `console.log(response.choices[0].message.content);`,
  ],
};

// Helper to get code with specific model
const getCodeWithModel = (tab: keyof typeof codeTemplates, model: string): string[] => {
  return codeTemplates[tab].map(line => line.replace("MODEL_PLACEHOLDER", model));
};

export function CodeExample() {
  const [activeTab, setActiveTab] = useState<keyof typeof codeTemplates>("curl");
  const [displayedCode, setDisplayedCode] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hasTypedOnce, setHasTypedOnce] = useState(false);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const modelCycleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentModel = popularModels[currentModelIndex];
  const currentCodeLines = getCodeWithModel(activeTab, currentModel);

  const handleCopy = async () => {
    const fullCode = currentCodeLines.join('\n');
    try {
      await navigator.clipboard.writeText(fullCode);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Code example has been copied successfully.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
  }, []);

  // Handle escape key to close expanded view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when expanded
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  // Handle tab changes - show full code immediately if already typed once
  useEffect(() => {
    if (hasTypedOnce) {
      setDisplayedCode(getCodeWithModel(activeTab, currentModel));
    }
  }, [activeTab, hasTypedOnce, currentModel]);

  // Update displayed code when model changes (after typing is complete)
  useEffect(() => {
    if (hasTypedOnce) {
      setDisplayedCode(getCodeWithModel(activeTab, currentModel));
    }
  }, [currentModelIndex, activeTab, hasTypedOnce]);

  // Typewriter effect - only runs once on initial load
  useEffect(() => {
    if (hasTypedOnce) return;

    if (currentLine >= currentCodeLines.length) {
      setHasTypedOnce(true);
      return;
    }

    const line = currentCodeLines[currentLine];

    if (currentChar <= line.length) {
      const timeout = setTimeout(() => {
        setDisplayedCode((prev) => {
          const newCode = [...prev];
          newCode[currentLine] = line.slice(0, currentChar);
          return newCode;
        });
        setCurrentChar(currentChar + 1);
      }, 15);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCurrentLine(currentLine + 1);
        setCurrentChar(0);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [currentLine, currentChar, currentCodeLines, hasTypedOnce]);

  // Model cycling effect - starts after typewriter completes
  useEffect(() => {
    if (!hasTypedOnce) return;

    // Clear any existing interval
    if (modelCycleIntervalRef.current) {
      clearInterval(modelCycleIntervalRef.current);
    }

    // Start cycling models every 3 seconds
    modelCycleIntervalRef.current = setInterval(() => {
      setCurrentModelIndex((prev) => (prev + 1) % popularModels.length);
    }, 3000);

    return () => {
      if (modelCycleIntervalRef.current) {
        clearInterval(modelCycleIntervalRef.current);
      }
    };
  }, [hasTypedOnce]);

  const codeContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger
            value="curl"
            className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30 px-2 sm:px-3"
          >
            cURL
          </TabsTrigger>
          <TabsTrigger
            value="python"
            className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30 px-2 sm:px-3"
          >
            Python
          </TabsTrigger>
          <TabsTrigger
            value="javascript"
            className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30 px-2 sm:px-3"
          >
            JavaScript
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition-all border border-indigo-500/30 hover:border-indigo-500/50"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <div className="flex gap-2">
            <button
              className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-300 transition-colors cursor-default"
              aria-label="Close (decorative)"
            />
            <button
              className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-colors cursor-default"
              aria-label="Minimize (decorative)"
            />
            <button
              onClick={isExpanded ? handleMinimize : handleExpand}
              className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-300 transition-colors cursor-pointer"
              aria-label={isExpanded ? "Minimize" : "Expand"}
            />
          </div>
        </div>
      </div>

      <pre className={`text-sm md:text-base overflow-x-auto ${isExpanded ? 'min-h-[60vh]' : 'min-h-[240px]'}`}>
        <code className="font-mono text-slate-100">
          {displayedCode.map((line, i) => (
            <div key={i} className="leading-relaxed">
              {line}
              {!hasTypedOnce && i === currentLine && currentChar <= currentCodeLines[currentLine]?.length && (
                <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-0.5" />
              )}
            </div>
          ))}
        </code>
      </pre>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="px-3 py-1.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
          256-BIT
        </div>
        <div className="px-3 py-1.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
          OAUTH
        </div>
        <div className="px-3 py-1.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
          TLS 1.3
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Expanded fullscreen overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleMinimize}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimize button in top right */}
            <button
              onClick={handleMinimize}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              aria-label="Minimize"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            <Tabs defaultValue="curl" value={activeTab} onValueChange={(v) => setActiveTab(v as keyof typeof codeTemplates)}>
              <TabsContent value={activeTab} className="mt-0">
                <Card className="p-6 md:p-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 shadow-2xl overflow-hidden">
                  {codeContent}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Normal section view */}
      <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Simple Integration</h2>
            <p className="text-lg text-muted-foreground">Get started in minutes with our intuitive API</p>
          </div>

          <Tabs defaultValue="curl" value={activeTab} onValueChange={(v) => setActiveTab(v as keyof typeof codeTemplates)}>
            <TabsContent value={activeTab}>
              <Card
                className="p-6 md:p-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 shadow-2xl animate-scale-in opacity-0 overflow-hidden"
              >
                {codeContent}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </>
  );
}
