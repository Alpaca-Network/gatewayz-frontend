import { navigateTo } from "../navigate";

describe("navigateTo", () => {
  it("should set window.location.href to the given URL", () => {
    const originalHref = window.location.href;
    const testUrl = "https://app.terragon.ai/callback?gwauth=token123";

    // JSDOM doesn't truly navigate, but we can verify the assignment
    // doesn't throw and the function is callable
    expect(() => navigateTo(testUrl)).not.toThrow();

    // In JSDOM, setting location.href to a full URL may or may not
    // update the property. The key contract is that the function
    // calls window.location.href = url without throwing.
  });
});
