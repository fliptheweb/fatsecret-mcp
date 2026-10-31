import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_OAUTH2_SCOPE,
  FALLBACK_OAUTH2_SCOPE,
  resolveRequestedScope,
  isInvalidScopeError,
  fetchOAuth2Token,
} from '../src/oauth2.ts';

test('resolveRequestedScope defaults to "basic premier" when no override is set', () => {
  assert.equal(resolveRequestedScope(undefined), DEFAULT_OAUTH2_SCOPE);
  assert.equal(resolveRequestedScope(''), DEFAULT_OAUTH2_SCOPE);
});

test('resolveRequestedScope honors FATSECRET_OAUTH2_SCOPE override', () => {
  assert.equal(resolveRequestedScope('basic'), 'basic');
  assert.equal(resolveRequestedScope('  basic premier  '), 'basic premier');
});

test('isInvalidScopeError only matches 400 responses with an invalid_scope body', () => {
  assert.equal(isInvalidScopeError(400, '{"error":"invalid_scope"}'), true);
  assert.equal(isInvalidScopeError(400, '{"error":"invalid_client"}'), false);
  assert.equal(isInvalidScopeError(401, '{"error":"invalid_scope"}'), false);
});

test('fetchOAuth2Token falls back to basic scope when the premier scope is rejected', async () => {
  const requestedScopes: string[] = [];

  const fakeFetch = (async (_url: string, init?: { body?: URLSearchParams }) => {
    const scope = (init?.body as URLSearchParams).get('scope') ?? '';
    requestedScopes.push(scope);

    if (scope === FALLBACK_OAUTH2_SCOPE) {
      return new Response(JSON.stringify({ access_token: 'token-basic', expires_in: 3600 }), {
        status: 200,
      });
    }

    return new Response('{"error":"invalid_scope"}', { status: 400 });
  }) as typeof fetch;

  const result = await fetchOAuth2Token(
    'client-id',
    'client-secret',
    DEFAULT_OAUTH2_SCOPE,
    fakeFetch,
  );

  assert.deepEqual(requestedScopes, [DEFAULT_OAUTH2_SCOPE, FALLBACK_OAUTH2_SCOPE]);
  assert.equal(result.accessToken, 'token-basic');
  assert.equal(result.scope, FALLBACK_OAUTH2_SCOPE);
});
