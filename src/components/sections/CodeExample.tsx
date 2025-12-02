import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const codeExamples = {
  python: [
    `from openai import OpenAI`,
    ``,
    `client = OpenAI(`,
    `    base_url="https://api.gatewayz.ai",`,
    `    api_key="gw_live_..."`,
    `)`,
    ``,
    `completion = client.chat.completions.create(`,
    `    model="gpt-4",`,
    `    messages=[`,
    `        {"role": "user", "content": "Hello!"}`,
    `    ]`,
    `)`,
    ``,
    `print(completion.choices[0].message)`,
  ],
  javascript: [
    `import OpenAI from "openai";`,
    ``,
    `const openai = new OpenAI({`,
    `  baseURL: "https://api.gatewayz.ai",`,
    `  apiKey: "gw_live_...",`,
    `});`,
    ``,
    `const completion = await openai.chat.completions.create({`,
    `  model: "gpt-4",`,
    `  messages: [`,
    `    { role: "user", content: "Hello!" }`,
    `  ],`,
    `});`,
    ``,
    `console.log(completion.choices[0].message);`,
  ],
  curl: [
    `curl https://api.gatewayz.ai/v1/chat/completions \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer gw_live_..." \\`,
    `  -d '{`,
    `    "model": "gpt-4",`,
    `    "messages": [`,
    `      {`,
    `        "role": "user",`,
    `        "content": "Hello!"`,
    `      }`,
    `    ]`,
    `  }'`,
  ],
};

export function CodeExample() {
  const [activeTab, setActiveTab] = useState<keyof typeof codeExamples>("python");
  const [displayedCode, setDisplayedCode] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [copied, setCopied] = useState(false);
  const [completedTabs, setCompletedTabs] = useState<Set<keyof typeof codeExamples>>(new Set());

  const currentCodeLines = codeExamples[activeTab];

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

  useEffect(() => {
    // If this tab has already been completed, show full code immediately
    if (completedTabs.has(activeTab)) {
      setDisplayedCode(currentCodeLines);
      setCurrentLine(currentCodeLines.length);
    } else {
      // Reset for new tab animation
      setDisplayedCode([]);
      setCurrentLine(0);
      setCurrentChar(0);
    }
  }, [activeTab]);

  useEffect(() => {
    // Don't run animation if this tab is already completed
    if (completedTabs.has(activeTab)) return;

    if (currentLine >= currentCodeLines.length) {
      // Mark this tab as completed
      setCompletedTabs(prev => new Set(prev).add(activeTab));
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
  }, [currentLine, currentChar, currentCodeLines, activeTab, completedTabs]);

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Simple Integration</h2>
          <p className="text-lg text-muted-foreground">Get started in minutes with our intuitive API</p>
        </div>

        <Tabs defaultValue="python" value={activeTab} onValueChange={(v) => setActiveTab(v as keyof typeof codeExamples)}>
          <TabsContent value={activeTab}>
            <Card
              className="p-6 md:p-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 shadow-2xl animate-scale-in opacity-0 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-slate-800/50 border border-slate-700">
                  <TabsTrigger 
                    value="python" 
                    className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30"
                  >
                    Python
                  </TabsTrigger>
                  <TabsTrigger 
                    value="javascript" 
                    className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30"
                  >
                    JavaScript
                  </TabsTrigger>
                  <TabsTrigger 
                    value="curl" 
                    className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 text-slate-400 data-[state=active]:border data-[state=active]:border-indigo-500/30"
                  >
                    cURL
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition-all border border-indigo-500/30 hover:border-indigo-500/50"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                </div>
              </div>

              <pre className="text-sm md:text-base overflow-x-auto min-h-[240px]">
                <code className="font-mono text-slate-100">
                  {displayedCode.map((line, i) => (
                    <div key={i} className="leading-relaxed">
                      {line}
                      {!completedTabs.has(activeTab) && i === currentLine && currentChar <= currentCodeLines[currentLine]?.length && (
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
