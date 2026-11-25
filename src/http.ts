// All FatSecret traffic funnels through here: the two openapi-fetch clients take it
// as their `fetch`, and the hand-rolled calls (profileRequest, postPublicJson, OAuth)
// use it directly. One place, so every tool gets timeouts and safe retries at once.

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 2000];

export interface ResilientFetchOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelaysMs?: number[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Undici reports stalls and refused connections as TypeError; aborts surface as DOMException
function isTransientError(error: unknown): boolean {
  return error instanceof TypeError || error instanceof DOMException;
}

function delayFor(retryDelaysMs: number[], attempt: number): number {
  return retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 0;
}

/**
 * fetch with a timeout on every attempt and retries for safe (GET) requests.
 * Writes are never retried: a timed-out write may have landed server-side, and
 * retrying it would create duplicates — fail fast with a clear error instead,
 * so the MCP client (not a 20-minute hang) decides what to do next.
 */
export async function resilientFetch(
  input: string | URL | Request,
  init?: Parameters<typeof fetch>[1],
  opts: ResilientFetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const retryDelaysMs = opts.retryDelaysMs ?? RETRY_DELAYS_MS;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const target = `${method} ${input instanceof Request ? input.url : String(input)}`;

  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let timedOut = false;
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (method === 'GET' && response.status >= 500 && attempt < maxAttempts) {
        await sleep(delayFor(retryDelaysMs, attempt));
        continue;
      }
      return response;
    } catch (error) {
      timedOut = error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
      // Writes are never retried: a timed-out write may have landed server-side
      if (method === 'GET' && attempt < maxAttempts && (timedOut || isTransientError(error))) {
        await sleep(delayFor(retryDelaysMs, attempt));
        continue;
      }
      if (timedOut) {
        throw new Error(`FatSecret API request timed out after ${timeoutMs}ms (${target}, attempt ${attempt}/${maxAttempts})`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
