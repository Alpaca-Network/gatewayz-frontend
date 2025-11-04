import WaitlistForm from "@/components/WaitlistForm";
import SocialProof from "@/components/sections/SocialProof";
import Typewriter from "@/components/Typewriter";

export default function HeroAgent() {
  return (
    <section aria-labelledby="hero-heading" className="pt-24 md:pt-32 relative overflow-hidden animate-enter">
      <div className="container relative z-10">
        <div className="grid items-center gap-12 md:gap-16 lg:grid-cols-2">
          <div className="fade-in min-w-0">
            <div className="mb-4">
              <span className="inline-block px-3 py-1 text-xs font-medium text-primary border border-primary/20 rounded-full bg-primary/5 encryption-text">
                AGENT INFRASTRUCTURE
              </span>
            </div>
            <h1 id="hero-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              <div className="flex flex-col">
                <div className="text-foreground">Agents that never <span className="text-accent">run out of models</span></div>
                <div className="text-accent overflow-hidden min-w-[180px] text-left">
                  <Typewriter 
                    texts={[
                      "One API.",
                      "500+ models.",
                      "Infinite flexibility."
                    ]} 
                    className="inline-block"
                    typingSpeed={80}
                    deletingSpeed={40}
                    delayBeforeStart={1000}
                    delayBetweenTexts={2000}
                    initialText=""
                  />
                </div>
              </div>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Unified API access to GPT-4o, Claude 3.7, Mistral, LLaMA, and hundreds of OSS models — perfect for multi-model agent frameworks.
            </p>

            <div className="mt-10 p-8 border border-primary/30 rounded-lg bg-card shadow-subtle glow-pulse floating">
              <div className="text-sm text-primary mb-6 font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                SECURE BETA ACCESS
              </div>
              <WaitlistForm compact />
              <p className="mt-4 text-sm text-muted-foreground">Bonus credits + priority onboarding</p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Perfect for:</span>
              <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">AutoGPT</span>
              <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">CrewAI</span>
              <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">LangChain</span>
              <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">Multi-Agent</span>
            </div>

            <div className="mt-6">
              <SocialProof compact />
            </div>
          </div>

          <div className="hidden lg:block slide-up">
            <div className="border border-primary/30 bg-card rounded-lg p-8 shadow-subtle code-highlight floating">
              <div className="text-sm font-medium text-primary mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                <span className="encryption-text">AGENT-READY INTERFACE</span>
              </div>
              <pre className="overflow-auto bg-secondary/50 p-6 text-sm rounded-lg border border-primary/20 font-mono">
{`import { gatewayz } from '@gatewayz/sdk'

// Agent orchestration
const agents = {
  reasoning: 'o3-pro',
  creative: 'claude-3.7',
  code: 'qwen3-coder'
}

const response = await gatewayz.chat.completions.create({
  model: agents.reasoning,
  messages: [{ role: 'user', content: task }],
  fallback: [agents.creative, agents.code]
})`}
              </pre>
              <div className="mt-6 flex items-center gap-6 text-sm">
                <span className="text-muted-foreground">Agent Features:</span>
                <span className="text-primary px-2 py-1 bg-primary/10 rounded text-xs font-mono">FALLBACK</span>
                <span className="text-primary px-2 py-1 bg-primary/10 rounded text-xs font-mono">ROUTING</span>
                <span className="text-primary px-2 py-1 bg-primary/10 rounded text-xs font-mono">UNIFIED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-primary/20 via-primary/5 to-transparent matrix-rain"></div>
        <div className="absolute top-0 right-10 w-px h-full bg-gradient-to-b from-primary/10 via-primary/3 to-transparent matrix-rain" style={{animationDelay: '3s'}}></div>
        <div className="absolute top-0 right-20 w-px h-full bg-gradient-to-b from-primary/15 via-primary/2 to-transparent matrix-rain" style={{animationDelay: '7s'}}></div>
      </div>
    </section>
  );
}