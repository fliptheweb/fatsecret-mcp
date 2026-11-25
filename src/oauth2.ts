const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

/**
 * Scopes a key may hold on top of "basic": "premier" (Premier plan: /foods/search/v5,
 * branded foods, autocomplete, categories...), "barcode", and the paid add-ons
 * "nlp" and "image-recognition". Each is granted separately.
 */
export const OPTIONAL_SCOPES = ['premier', 'barcode', 'nlp', 'image-recognition'];

// RFC 6749 §5.2: a scope the client isn't entitled to is answered with 400 invalid_scope
export function isInvalidScopeError(status: number, body: string): boolean {
  return status === 400 && /invalid_scope/i.test(body);
}

export function hasScope(scope: string | null, name: string): boolean {
  return !!scope && scope.split(' ').includes(name);
}

export function hasPremierScope(scope: string | null): boolean {
  return hasScope(scope, 'premier');
}

type Token = { accessToken: string; expiresIn: number; scope: string };

/** One token request; null means the key isn't entitled to `scope` (invalid_scope), other errors throw. */
async function requestToken(
  clientId: string,
  clientSecret: string,
  scope: string,
  fetchImpl: typeof fetch,
): Promise<Token | null> {
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
  if (isInvalidScopeError(response.status, body)) return null;
  throw new Error(`OAuth2 token request failed: ${response.status} ${body}`);
}

/** Requests a client-credentials token, trying each scope in order until one is granted. */
export async function fetchOAuth2Token(
  clientId: string,
  clientSecret: string,
  scopes: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Token> {
  for (const scope of scopes) {
    const token = await requestToken(clientId, clientSecret, scope, fetchImpl);
    if (token) return token;
  }
  throw new Error(`OAuth2 token request failed: 400 invalid_scope (tried: ${scopes.join(' | ')})`);
}

/**
 * First token for a key: asks for every optional scope at once. One refused scope fails the
 * whole request, so on invalid_scope each optional scope is probed alone and the token is
 * requested for the granted ones. Reuse the returned `scope` for refreshes.
 */
export async function detectOAuth2Token(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Token> {
  const all = ['basic', ...OPTIONAL_SCOPES].join(' ');
  const token = await requestToken(clientId, clientSecret, all, fetchImpl);
  if (token) return token;

  const granted: string[] = [];
  for (const scope of OPTIONAL_SCOPES) {
    if (await requestToken(clientId, clientSecret, `basic ${scope}`, fetchImpl)) granted.push(scope);
  }
  return fetchOAuth2Token(clientId, clientSecret, [['basic', ...granted].join(' ')], fetchImpl);
}
