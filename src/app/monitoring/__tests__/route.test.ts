import { NextRequest, NextResponse } from "next/server";

// Mock fetch for upstream Sentry calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Valid Sentry DSN for testing
const VALID_SENTRY_DSN = "https://public@sentry.io/1234567";

/**
 * Create a mock Sentry envelope as a string
 */
function createMockEnvelopeString(dsn: string = VALID_SENTRY_DSN): string {
  const header = JSON.stringify({ dsn });
  const payload = '{"type":"session"}';
  return `${header}\n${payload}`;
}

/**
 * Create a mock NextRequest with proper arrayBuffer support
 */
function createMockRequest(body: string): NextRequest {
  const encoder = new TextEncoder();
  const bodyBuffer = encoder.encode(body).buffer;

  const request = {
    method: "POST",
    url: "http://localhost/monitoring",
    arrayBuffer: jest.fn().mockResolvedValue(bodyBuffer),
    text: jest.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as NextRequest;

  return request;
}

// Import the route handlers fresh for each test to reset rate limit state
let POST: (request: NextRequest) => Promise<NextResponse>;
let OPTIONS: () => Promise<NextResponse>;

beforeEach(async () => {
  jest.clearAllMocks();
  // Reset the module to get fresh rate limit state
  jest.resetModules();
  const routeModule = await import("../route");
  POST = routeModule.POST;
  OPTIONS = routeModule.OPTIONS;
});

describe("Monitoring Route (Sentry Tunnel)", () => {
  describe("CORS", () => {
    it("should return CORS headers on OPTIONS request", async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type"
      );
    });

    it("should include CORS headers in POST response", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("Envelope Validation", () => {
    it("should reject requests with invalid envelope format", async () => {
      const encoder = new TextEncoder();
      const invalidBody = "not json";
      const request = {
        method: "POST",
        url: "http://localhost/monitoring",
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(encoder.encode(invalidBody).buffer),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Invalid envelope");
    });

    it("should reject requests with missing DSN", async () => {
      const encoder = new TextEncoder();
      const noDsnBody = JSON.stringify({ event_id: "123" });
      const request = {
        method: "POST",
        url: "http://localhost/monitoring",
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(encoder.encode(noDsnBody).buffer),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Invalid envelope");
    });

    it("should reject requests with non-numeric project ID", async () => {
      const invalidProjectDsn = "https://public@sentry.io/abc";
      const request = createMockRequest(
        createMockEnvelopeString(invalidProjectDsn)
      );

      const response = await POST(request);

      expect(response.status).toBe(403);
      expect(await response.text()).toBe("Invalid project");
    });

    it("should reject requests with invalid Sentry host", async () => {
      const invalidHostDsn = "https://public@evil-sentry.io/1234567";
      const request = createMockRequest(
        createMockEnvelopeString(invalidHostDsn)
      );

      const response = await POST(request);

      expect(response.status).toBe(403);
      expect(await response.text()).toBe("Invalid host");
    });

    it("should accept requests with valid sentry.io subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const subdomainDsn = "https://public@o123.ingest.sentry.io/1234567";
      const request = createMockRequest(createMockEnvelopeString(subdomainDsn));

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept hosts with mixed case (DNS is case-insensitive)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      // Test uppercase host - should be accepted per RFC 1035
      const mixedCaseDsn = "https://public@SENTRY.IO/1234567";
      const request = createMockRequest(createMockEnvelopeString(mixedCaseDsn));

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept subdomains with mixed case", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const mixedCaseSubdomainDsn = "https://public@O123.Ingest.Sentry.IO/1234567";
      const request = createMockRequest(createMockEnvelopeString(mixedCaseSubdomainDsn));

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Request Forwarding", () => {
    it("should forward valid requests to Sentry", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://sentry.io/api/1234567/envelope/",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-sentry-envelope",
          },
        })
      );
    });

    it("should preserve body in request", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const envelope = createMockEnvelopeString();
      const request = createMockRequest(envelope);
      await POST(request);

      // Verify the body was passed through
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].body).toBeDefined();
    });

    it("should return upstream response status", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        body: null,
      });

      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);

      expect(response.status).toBe(202);
    });
  });

  describe("Rate Limiting", () => {
    it("should allow multiple requests within rate limit", async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        body: null,
      });

      // Send 5 requests (within the per-second limit of 5)
      const responses: Response[] = [];
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(createMockEnvelopeString());
        const response = await POST(request);
        responses.push(response);
      }

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should return 429 when rate limit exceeded", async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        body: null,
      });

      // Send more than 5 requests (exceed per-second limit)
      const responses: Response[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createMockRequest(createMockEnvelopeString());
        const response = await POST(request);
        responses.push(response);
      }

      // Some should be rate limited (429)
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on internal error", async () => {
      const request = {
        method: "POST",
        url: "http://localhost/monitoring",
        arrayBuffer: jest.fn().mockRejectedValue(new Error("Network error")),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Internal Server Error");
    });

    it("should handle upstream 429 gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        body: null,
      });

      // Spy on console.warn to verify logging
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);

      // Should pass through upstream 429
      expect(response.status).toBe(429);

      // Should log a warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Upstream returned 429")
      );

      consoleSpy.mockRestore();
    });

    it("should return 504 on upstream timeout", async () => {
      // Create an AbortError to simulate timeout
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);

      expect(response.status).toBe(504);
      expect(await response.text()).toBe("Gateway Timeout");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("timed out")
      );

      consoleSpy.mockRestore();
    });

    it("should include AbortSignal in fetch call for timeout", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        body: null,
      });

      const request = createMockRequest(createMockEnvelopeString());
      await POST(request);

      // Verify fetch was called with signal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
});

describe("Rate Limit Configuration", () => {
  it("should have reasonable rate limits allowing burst on page load", async () => {
    // This test documents and verifies the expected rate limit configuration
    // The configuration is at the top of the route.ts file:
    // - maxRequestsPerMinute: 30 (allow normal page load patterns)
    // - maxRequestsPerSecond: 5 (allow burst on page load)

    // We verify this by making sure we can send more than the old limit
    // of 1 request per second without getting rate limited
    mockFetch.mockResolvedValue({
      status: 200,
      body: null,
    });

    // Send 5 requests rapidly (would have been rate limited with old limit of 1/sec)
    const responses: Response[] = [];
    for (let i = 0; i < 5; i++) {
      const request = createMockRequest(createMockEnvelopeString());
      const response = await POST(request);
      responses.push(response);
    }

    // All 5 should succeed with the new 5/second limit
    const successCount = responses.filter((r) => r.status === 200).length;
    expect(successCount).toBe(5);
  });
});
