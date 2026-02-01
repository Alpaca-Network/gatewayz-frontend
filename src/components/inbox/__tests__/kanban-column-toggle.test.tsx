import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanColumnToggle } from "../kanban-column-toggle";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Columns2: () => <div data-testid="columns2-icon" />,
  Square: () => <div data-testid="square-icon" />,
}));

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
  }) => (
    <div
      data-testid="toggle-group"
      data-value={value}
      className={className}
      {...props}
    >
      {/* Pass onValueChange down to children via context simulation */}
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onClick?: () => void; value?: string }>, {
              onClick: () => onValueChange((child as React.ReactElement<{ value?: string }>).props.value || ""),
            })
          : child
      )}
    </div>
  ),
  ToggleGroupItem: ({
    children,
    value,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
    onClick?: () => void;
  }) => (
    <button data-testid={`toggle-item-${value}`} onClick={onClick} data-value={value} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock the store
const mockColumnView = { current: "1" as "1" | "2" };
const mockSetColumnView = jest.fn((view: "1" | "2") => {
  mockColumnView.current = view;
});
const mockSyncColumnViewState = jest.fn();

jest.mock("@/lib/store/inbox-ui-store", () => ({
  useInboxUIStore: () => ({
    columnView: mockColumnView.current,
    setColumnView: mockSetColumnView,
    syncColumnViewState: mockSyncColumnViewState,
  }),
}));

// Need to import React for the mock
import React from "react";

describe("KanbanColumnToggle", () => {
  beforeEach(() => {
    mockColumnView.current = "1";
    mockSetColumnView.mockClear();
    mockSyncColumnViewState.mockClear();
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
});
