/**
 * FatSecret reports most failures as HTTP 200 with an {"error": {...}} body, so the
 * tool result has to be flagged by looking at the payload, not only at the HTTP status.
 */
export function isApiError(data: unknown): boolean {
  return !!data && typeof data === 'object' && 'error' in data;
}

function dropUrls(key: string, value: unknown): unknown {
  return key.endsWith('_url') ? undefined : value;
}

/** MCP tool result; `failed` marks transport-level failures (non-2xx with no data). */
export function toolResult(data: unknown, failed = false) {
  return {
    // Compact JSON without *_url links (food_url, serving_url...): together ~55% fewer tokens
    content: [{ type: 'text' as const, text: JSON.stringify(data ?? null, dropUrls) }],
    ...(failed || isApiError(data) ? { isError: true } : {}),
  };
}

/** openapi-fetch response → tool result; no data means a non-2xx response whose body is in error. */
export function result({ data, error }: { data?: unknown; error?: unknown }) {
  return toolResult(data ?? error, data === undefined);
}
