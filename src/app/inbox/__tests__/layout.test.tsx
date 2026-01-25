import { render, cleanup } from "@testing-library/react";
import { InboxLayoutClient } from "../inbox-layout-client";
import { inboxMetadata } from "../metadata";

describe("InboxLayoutClient", () => {
  afterEach(() => {
    cleanup();
    // Clean up body classes
    document.body.classList.remove("inbox-page");
    document.body.style.overflow = "";
  });

  it("should render children", () => {
    const { getByText } = render(
      <InboxLayoutClient>
        <div>Test Content</div>
      </InboxLayoutClient>
    );

    expect(getByText("Test Content")).toBeInTheDocument();
  });

  it("should add inbox-page class to body on mount", () => {
    render(
      <InboxLayoutClient>
        <div>Test</div>
      </InboxLayoutClient>
    );

    expect(document.body.classList.contains("inbox-page")).toBe(true);
  });

  it("should hide body overflow on mount", () => {
    render(
      <InboxLayoutClient>
        <div>Test</div>
      </InboxLayoutClient>
    );

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("should remove inbox-page class from body on unmount", () => {
    const { unmount } = render(
      <InboxLayoutClient>
        <div>Test</div>
      </InboxLayoutClient>
    );

    expect(document.body.classList.contains("inbox-page")).toBe(true);

    unmount();

    expect(document.body.classList.contains("inbox-page")).toBe(false);
  });

  it("should restore body overflow on unmount", () => {
    const { unmount } = render(
      <InboxLayoutClient>
        <div>Test</div>
      </InboxLayoutClient>
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("should have correct container classes", () => {
    const { container } = render(
      <InboxLayoutClient>
        <div>Test</div>
      </InboxLayoutClient>
    );

    const layoutDiv = container.firstChild as HTMLElement;
    expect(layoutDiv.classList.contains("inbox-container")).toBe(true);
    expect(layoutDiv.classList.contains("h-[calc(100dvh-65px)]")).toBe(true);
    expect(layoutDiv.classList.contains("w-full")).toBe(true);
    expect(layoutDiv.classList.contains("overflow-hidden")).toBe(true);
  });
});

describe("inboxMetadata", () => {
  it("should have correct title", () => {
    expect(inboxMetadata.title).toBe("AI Agent Inbox - Gatewayz x Terragon");
  });

  it("should have correct description", () => {
    expect(inboxMetadata.description).toBe(
      "AI-powered coding agent inbox. Review PRs, manage code changes, and collaborate with AI agents to streamline your development workflow."
    );
  });

  it("should have openGraph configuration", () => {
    expect(inboxMetadata.openGraph).toBeDefined();
    expect(inboxMetadata.openGraph?.title).toBe("AI Agent Inbox - Gatewayz x Terragon");
    expect(inboxMetadata.openGraph?.url).toBe("https://gatewayz.ai/inbox");
  });

  it("should have inbox OG image configured", () => {
    const images = inboxMetadata.openGraph?.images as Array<{ url: string }>;
    expect(images).toBeDefined();
    expect(images[0]?.url).toBe("/inbox-og-image.png");
  });

  it("should have correct OG image dimensions", () => {
    const images = inboxMetadata.openGraph?.images as Array<{
      url: string;
      width: number;
      height: number;
    }>;
    expect(images).toBeDefined();
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
  });

  it("should have twitter card configuration", () => {
    expect(inboxMetadata.twitter).toBeDefined();
    expect(inboxMetadata.twitter?.card).toBe("summary_large_image");
    expect(inboxMetadata.twitter?.title).toBe("AI Agent Inbox - Gatewayz x Terragon");
  });

  it("should have twitter image pointing to inbox OG image", () => {
    const images = inboxMetadata.twitter?.images as string[];
    expect(images).toContain("/inbox-og-image.png");
  });

  it("should have twitter creator handle", () => {
    expect(inboxMetadata.twitter?.creator).toBe("@gatewayz_ai");
  });
});
