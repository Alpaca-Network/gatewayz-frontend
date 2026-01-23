import { render, cleanup } from "@testing-library/react";
import InboxLayout from "../layout";

describe("InboxLayout", () => {
  afterEach(() => {
    cleanup();
    // Clean up body classes
    document.body.classList.remove("inbox-page");
    document.body.style.overflow = "";
  });

  it("should render children", () => {
    const { getByText } = render(
      <InboxLayout>
        <div>Test Content</div>
      </InboxLayout>
    );

    expect(getByText("Test Content")).toBeInTheDocument();
  });

  it("should add inbox-page class to body on mount", () => {
    render(
      <InboxLayout>
        <div>Test</div>
      </InboxLayout>
    );

    expect(document.body.classList.contains("inbox-page")).toBe(true);
  });

  it("should hide body overflow on mount", () => {
    render(
      <InboxLayout>
        <div>Test</div>
      </InboxLayout>
    );

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("should remove inbox-page class from body on unmount", () => {
    const { unmount } = render(
      <InboxLayout>
        <div>Test</div>
      </InboxLayout>
    );

    expect(document.body.classList.contains("inbox-page")).toBe(true);

    unmount();

    expect(document.body.classList.contains("inbox-page")).toBe(false);
  });

  it("should restore body overflow on unmount", () => {
    const { unmount } = render(
      <InboxLayout>
        <div>Test</div>
      </InboxLayout>
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("should have correct container classes", () => {
    const { container } = render(
      <InboxLayout>
        <div>Test</div>
      </InboxLayout>
    );

    const layoutDiv = container.firstChild as HTMLElement;
    expect(layoutDiv.classList.contains("inbox-container")).toBe(true);
    expect(layoutDiv.classList.contains("h-[calc(100dvh-65px)]")).toBe(true);
    expect(layoutDiv.classList.contains("w-full")).toBe(true);
    expect(layoutDiv.classList.contains("overflow-hidden")).toBe(true);
  });
});
