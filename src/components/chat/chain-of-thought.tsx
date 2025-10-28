"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BrainIcon,
  ChevronDownIcon,
  DotIcon,
  LucideIcon,
} from "lucide-react";
import {
  ComponentProps,
  ReactNode,
  createContext,
  memo,
  useContext,
  useMemo,
} from "react";

type ChainOfThoughtContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null
);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);

  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought"
    );
  }

  return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });

    const chainOfThoughtContext = useMemo(
      () => ({
        isOpen: Boolean(isOpen),
        setIsOpen,
      }),
      [isOpen, setIsOpen]
    );

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div
          className={cn("flex flex-col gap-0", className)}
          {...props}
        >
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  }
);

ChainOfThought.displayName = "ChainOfThought";

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  badge?: ReactNode;
};

export const ChainOfThoughtHeader = memo(
  ({ className, children, badge, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:text-foreground focus:outline-none focus-visible:outline-none",
            className
          )}
          {...props}
        >
          <BrainIcon className="size-4 shrink-0" />
          <span className="flex-1 text-left">{children ?? "Chain of Thought"}</span>
          {badge && (
            <span className="shrink-0 text-xs text-muted-foreground">{badge}</span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 transition-transform",
              isOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </CollapsibleTrigger>
      </Collapsible>
    );
  }
);

ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            "px-4 pb-4 pt-2 space-y-3 text-sm text-muted-foreground",
            "data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2",
            className
          )}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  }
);

ChainOfThoughtContent.displayName = "ChainOfThoughtContent";

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: LucideIcon;
  label: ReactNode;
  description?: ReactNode;
  status?: "complete" | "active" | "pending";
  badge?: ReactNode;
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = "complete",
    children,
    badge,
    ...props
  }: ChainOfThoughtStepProps) => {
    const statusStyles = {
      complete: "text-foreground",
      active: "text-foreground",
      pending: "text-muted-foreground",
    } as const;

    return (
      <div
        className={cn(
          "flex gap-3 text-sm",
          statusStyles[status],
          "fade-in-0 slide-in-from-top-2 animate-in",
          className
        )}
        {...props}
      >
        <div className="relative mt-1.5 flex-shrink-0">
          <Icon className="size-4" />
          <div className="-mx-px absolute top-6 bottom-0 left-1/2 w-px bg-border" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2 text-sm font-medium">
            <div>{label}</div>
            {badge}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
          {children}
        </div>
      </div>
    );
  }
);

ChainOfThoughtStep.displayName = "ChainOfThoughtStep";

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
  )
);

ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge
      className={cn("gap-1 px-2 py-0.5 font-normal text-xs", className)}
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  )
);

ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn("mt-2 space-y-2", className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
);

ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
