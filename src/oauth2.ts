const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

export const DEFAULT_OAUTH2_SCOPE = 'basic premier';
export const FALLBACK_OAUTH2_SCOPE = 'basic';

export interface OAuth2TokenResult {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

type FetchLike = typeof fetch;

/**
 * Resolves the OAuth2 scope to request. Defaults to "basic premier" so Premier
 * keys get premier-only data (e.g. branded foods); set FATSECRET_OAUTH2_SCOPE
 * to override (e.g. to "basic" to skip the premier attempt entirely).
 */
export function resolveRequestedScope(envOverride?: string): string {
  const trimmed = envOverride?.trim();
  return trimmed || DEFAULT_OAUTH2_SCOPE;
}

/**
 * FatSecret returns 400 invalid_scope when the app key isn't entitled to the
 * requested scope (e.g. a free key requesting "premier").
 */
export function isInvalidScopeError(status: number, body: string): boolean {
  return status === 400 && /invalid_scope/i.test(body);
}

async function requestToken(
  clientId: string,
  clientSecret: string,
  scope: string,
  fetchImpl: FetchLike,
): Promise<Response> {
  return fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  });
}

/**
 * Fetches an OAuth2 client-credentials token for the requested scope.
 *
 * Free (non-Premier) FatSecret keys reject the "premier" scope with
 * `invalid_scope`. When that happens for the default scope, we transparently
 * retry with the "basic" fallback so free keys keep working without any
 * configuration change.
 */
export async function fetchOAuth2Token(
  clientId: string,
  clientSecret: string,
  requestedScope: string,
  fetchImpl: FetchLike = fetch,
): Promise<OAuth2TokenResult> {
  let response = await requestToken(clientId, clientSecret, requestedScope, fetchImpl);
  let scopeUsed = requestedScope;

  if (!response.ok) {
    const body = await response.text();

    if (requestedScope !== FALLBACK_OAUTH2_SCOPE && isInvalidScopeError(response.status, body)) {
      scopeUsed = FALLBACK_OAUTH2_SCOPE;
      response = await requestToken(clientId, clientSecret, scopeUsed, fetchImpl);

      if (!response.ok) {
        const fallbackBody = await response.text();
        throw new Error(`OAuth2 token request failed: ${response.status} ${fallbackBody}`);
      }
    } else {
      throw new Error(`OAuth2 token request failed: ${response.status} ${body}`);
    }
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: scopeUsed,
  };
}
