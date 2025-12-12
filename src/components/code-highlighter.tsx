'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

type SyntaxHighlighterProps = ComponentProps<any>;

// Lazy load syntax highlighter - only needed on onboarding/docs pages
const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(m => m.Prism),
  {
    loading: () => (
      <pre className="bg-slate-800 dark:bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto">
        <code className="text-sm">Loading...</code>
      </pre>
    ),
    ssr: false
  }
);

interface CodeHighlighterProps extends Omit<SyntaxHighlighterProps, 'children'> {
  children: string;
  language: string;
}

export function CodeHighlighter({ children, language, ...props }: CodeHighlighterProps) {
  return (
    <SyntaxHighlighter language={language} {...props}>
      {children}
    </SyntaxHighlighter>
  );
}
