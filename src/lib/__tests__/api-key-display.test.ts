import { isMaskedApiKey, matchesMaskedKey, shortApiKey } from "../api-key-display";

const FULL = "gw_live_" + "x".repeat(39) + "a1b2";

describe("api-key-display", () => {
  it("recognises masked keys from list responses", () => {
    expect(isMaskedApiKey("gw_live_...a1b2")).toBe(true);
    expect(isMaskedApiKey(FULL)).toBe(false);
    expect(isMaskedApiKey(undefined)).toBe(false);
  });

  it("shortens a full key and leaves a masked one alone", () => {
    expect(shortApiKey(FULL)).toBe("gw_live_xxxx...a1b2");
    expect(shortApiKey("gw_live_...a1b2")).toBe("gw_live_...a1b2");
  });

  it("matches the session key to its masked list entry by last 4", () => {
    expect(matchesMaskedKey(FULL, "gw_live_...a1b2")).toBe(true);
    expect(matchesMaskedKey(FULL, "gw_live_...zzzz")).toBe(false);
    expect(matchesMaskedKey("gw_live_...a1b2", "gw_live_...a1b2")).toBe(false);
    expect(matchesMaskedKey(null, "gw_live_...a1b2")).toBe(false);
  });
});
