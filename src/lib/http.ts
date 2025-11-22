const JSON_CONTENT_TYPE = /application\/json/i;
const MAX_ERROR_PREVIEW_CHARS = 200;

async function readBodyPreview(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, MAX_ERROR_PREVIEW_CHARS);
  } catch {
    return '';
  }
}

/**
 * Safely parse a fetch Response as JSON while guarding against HTML/error pages.
 * Returns null if the response is non-OK, lacks a JSON content-type, or parsing fails.
 */
export async function safeParseJson<T = unknown>(response: Response, context = 'fetch'): Promise<T | null> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!response.ok) {
    const preview = await readBodyPreview(response);
    console.warn(
      `${context}: non-OK response (${response.status} ${response.statusText}). Preview: ${preview}`
    );
    return null;
  }

  if (!JSON_CONTENT_TYPE.test(contentType)) {
    const preview = await readBodyPreview(response);
    console.warn(
      `${context}: expected JSON but received content-type "${contentType || 'unknown'}". Preview: ${preview}`
    );
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`${context}: failed to parse JSON body`, error);
    return null;
  }
}
