import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Columns2: () => <div data-testid="columns2-icon" />,
  Square: () => <div data-testid="square-icon" />,
}));

// Store the onValueChange callback to test it
let capturedOnValueChange: ((value: string) => void) | null = null;

// Mock the UI components
jest.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({
    children,
    value,
    onValueChange,
    className,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
  }) => {
    // Capture the onValueChange for testing
    capturedOnValueChange = onValueChange;
    return (
      <div
        data-testid="toggle-group"
        data-value={value}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  },
  ToggleGroupItem: ({
    children,
    value,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <button
      data-testid={`toggle-item-${value}`}
      data-value={value}
      onClick={() => capturedOnValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock the store
const mockSetColumnView = jest.fn();
const mockSyncColumnViewState = jest.fn();

jest.mock("@/lib/store/inbox-ui-store", () => ({
  useInboxUIStore: () => ({
    columnView: "1",
    setColumnView: mockSetColumnView,
    syncColumnViewState: mockSyncColumnViewState,
  }),
}));

// Import the component after mocks are set up
import { KanbanColumnToggle } from "../kanban-column-toggle";

describe("KanbanColumnToggle", () => {
  beforeEach(() => {
    mockSetColumnView.mockClear();
    mockSyncColumnViewState.mockClear();
    capturedOnValueChange = null;
  });

  it("should render the toggle group", () => {
    render(<KanbanColumnToggle />);

    expect(screen.getByTestId("toggle-group")).toBeInTheDocument();
  });

  it("should render single column toggle option", () => {
    render(<KanbanColumnToggle />);

    expect(screen.getByTestId("toggle-item-1")).toBeInTheDocument();
  });

  it("should render two column toggle option", () => {
    render(<KanbanColumnToggle />);

    expect(screen.getByTestId("toggle-item-2")).toBeInTheDocument();
  });

  it("should call syncColumnViewState on mount", () => {
    render(<KanbanColumnToggle />);

    expect(mockSyncColumnViewState).toHaveBeenCalled();
  });

  it("should call setColumnView when single column is clicked", () => {
    render(<KanbanColumnToggle />);

    const singleColumnButton = screen.getByTestId("toggle-item-1");
    fireEvent.click(singleColumnButton);

    expect(mockSetColumnView).toHaveBeenCalledWith("1");
  });

  it("should call setColumnView when two column is clicked", () => {
    render(<KanbanColumnToggle />);

    const twoColumnButton = screen.getByTestId("toggle-item-2");
    fireEvent.click(twoColumnButton);

    expect(mockSetColumnView).toHaveBeenCalledWith("2");
  });

  it("should call onViewChange callback when view changes", () => {
    const mockOnViewChange = jest.fn();
    render(<KanbanColumnToggle onViewChange={mockOnViewChange} />);

    const twoColumnButton = screen.getByTestId("toggle-item-2");
    fireEvent.click(twoColumnButton);

    expect(mockOnViewChange).toHaveBeenCalledWith("2");
  });

  it("should apply custom className", () => {
    render(<KanbanColumnToggle className="custom-class" />);

    const toggleGroup = screen.getByTestId("toggle-group");
    expect(toggleGroup).toHaveClass("custom-class");
  });

  it("should have accessible labels", () => {
    render(<KanbanColumnToggle />);

    expect(screen.getByTestId("toggle-item-1")).toHaveAttribute(
      "aria-label",
      "Single column view"
    );
    expect(screen.getByTestId("toggle-item-2")).toHaveAttribute(
      "aria-label",
      "Two column view"
    );
  });

  it("should not call callbacks when invalid value is provided", () => {
    const mockOnViewChange = jest.fn();
    render(<KanbanColumnToggle onViewChange={mockOnViewChange} />);

    // Manually trigger with an invalid value
    if (capturedOnValueChange) {
      capturedOnValueChange("");
    }

    expect(mockSetColumnView).not.toHaveBeenCalled();
    expect(mockOnViewChange).not.toHaveBeenCalled();
  });
});
