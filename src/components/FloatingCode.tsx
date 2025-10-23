export function FloatingCode() {
  const codeSnippets = [
    'gpt-4o',
    'claude-3.7',
    'gemini-pro',
    'mixtral',
    'llama-3',
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {codeSnippets.map((snippet, i) => (
        <div
          key={i}
          className="absolute text-xs font-mono text-muted-foreground/20 animate-float"
          style={{
            left: `${15 + i * 18}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.5}s`,
          }}
          aria-hidden="true"
        >
          {snippet}
        </div>
      ))}
    </div>
  );
}
