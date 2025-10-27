'use client';

import { Badge } from '@/components/ui/badge';
import { Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISDKModelOptionProps {
  id: string;
  name: string;
  provider: string;
  supportsThinking: boolean;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * Component for displaying AI SDK model options in the model selector
 * Highlights models with thinking/reasoning support
 */
export function AISDKModelOption({
  id,
  name,
  provider,
  supportsThinking,
  description,
  selected = false,
  onClick,
}: AISDKModelOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-lg transition-colors border',
        selected
          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {name}
            </span>
            {supportsThinking && (
              <Badge
                variant="secondary"
                className="flex-shrink-0 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700"
              >
                <Brain className="w-3 h-3 mr-1" />
                Thinking
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="text-gray-600 dark:text-gray-400">{provider}</span>
          </div>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
