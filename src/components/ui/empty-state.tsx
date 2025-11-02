import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

/**
 * Reusable empty state component
 * Used when there's no data to display in a section
 *
 * @example
 * <EmptyState
 *   icon={<KeyIcon className="h-6 w-6" />}
 *   title="No API keys yet"
 *   description="Create your first API key to get started"
 *   action={<Button>Create API Key</Button>}
 * />
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 border border-border rounded-lg bg-muted/30">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
