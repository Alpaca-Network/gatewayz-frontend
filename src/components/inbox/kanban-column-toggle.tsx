"use client";

import { useEffect } from "react";
import { Columns2, Square } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInboxUIStore, ColumnView } from "@/lib/store/inbox-ui-store";

interface KanbanColumnToggleProps {
  /**
   * Callback fired when the column view changes.
   * Can be used to communicate the change to an embedded iframe.
   */
  onViewChange?: (view: ColumnView) => void;
  /**
   * Additional CSS classes for the container.
   */
  className?: string;
}

/**
 * A toggle component that allows users to switch between 1-column and 2-column
 * views in the Kanban task card display.
 *
 * The preference is persisted to localStorage and can optionally communicate
 * changes via a callback (e.g., to send postMessage to an embedded iframe).
 */
export function KanbanColumnToggle({
  onViewChange,
  className,
}: KanbanColumnToggleProps) {
  const { columnView, setColumnView, syncColumnViewState } = useInboxUIStore();

  // Sync state from localStorage on mount (handles SSR hydration)
  useEffect(() => {
    syncColumnViewState();
  }, [syncColumnViewState]);

  const handleValueChange = (value: string) => {
    // ToggleGroup can return empty string when nothing selected
    if (value === "1" || value === "2") {
      setColumnView(value);
      onViewChange?.(value);
    }
  };

  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={columnView}
        onValueChange={handleValueChange}
        className={className}
        aria-label="Column view selector"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="1"
              aria-label="Single column view"
              size="sm"
              variant="outline"
            >
              <Square className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Single column view</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="2"
              aria-label="Two column view"
              size="sm"
              variant="outline"
            >
              <Columns2 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Two column view</p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}

export default KanbanColumnToggle;
