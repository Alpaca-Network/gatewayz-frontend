import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/app/api/middleware/auth";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";

/**
 * DELETE /api/user/api-keys/[keyId]
 * Proxy route for deleting an API key
 * Requires Authorization header with Bearer token
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const body = await request.json();
    const { keyId } = await params;

    console.log(`[API /api/user/api-keys/${keyId} DELETE] Proxying delete API key request to backend`);

    const response = await proxyFetch(`${API_BASE_URL}/user/api-keys/${keyId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[API /api/user/api-keys/${keyId} DELETE] Backend request failed:`, response.status, responseText);
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`[API /api/user/api-keys/${keyId} DELETE] Backend request successful`);

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return handleApiError(error, "API /api/user/api-keys/[keyId] DELETE");
  }
}
