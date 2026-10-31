const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

/**
 * Scopes to try, best first. Premier keys get "basic premier" (needed for e.g. /foods/search/v5
 * and branded foods); free keys are refused it with invalid_scope and fall through to "basic".
 */
export const OAUTH2_SCOPES = ['basic premier', 'basic'];

// RFC 6749 §5.2: a scope the client isn't entitled to is answered with 400 invalid_scope
export function isInvalidScopeError(status: number, body: string): boolean {
  return status === 400 && /invalid_scope/i.test(body);
}

export function hasPremierScope(scope: string | null): boolean {
  return !!scope && scope.split(' ').includes('premier');
}

/** Requests a client-credentials token, trying each scope in order until one is granted. */
export async function fetchOAuth2Token(
  clientId: string,
  clientSecret: string,
  scopes: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number; scope: string }> {
  for (const [i, scope] of scopes.entries()) {
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { access_token: string; expires_in: number };
      return { accessToken: data.access_token, expiresIn: data.expires_in, scope };
    }

    const body = await response.text();
    const isLast = i === scopes.length - 1;
    if (isLast || !isInvalidScopeError(response.status, body)) {
      throw new Error(`OAuth2 token request failed: ${response.status} ${body}`);
    }
  }
  throw new Error('OAuth2 token request failed: no scopes to request');
}
