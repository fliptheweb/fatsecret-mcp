import test from 'node:test';
import assert from 'node:assert/strict';

import { OAUTH2_SCOPES, hasPremierScope, isInvalidScopeError, fetchOAuth2Token } from '../src/oauth2.ts';

// Fake token endpoint: grants only the scopes in `allowed`, answers others like FatSecret does
function fakeTokenEndpoint(allowed: string[], refusal = { status: 400, body: '{"error":"invalid_scope"}' }) {
  const requested: string[] = [];
  const fetchImpl = (async (_url: string, init?: { body?: URLSearchParams }) => {
    const scope = (init?.body as URLSearchParams).get('scope') ?? '';
    requested.push(scope);
    if (allowed.includes(scope)) {
      return new Response(JSON.stringify({ access_token: `token-${scope}`, expires_in: 3600 }), { status: 200 });
    }
    return new Response(refusal.body, { status: refusal.status });
  }) as typeof fetch;
  return { fetchImpl, requested };
}

test('isInvalidScopeError only matches 400 responses with an invalid_scope body', () => {
  assert.equal(isInvalidScopeError(400, '{"error":"invalid_scope"}'), true);
  assert.equal(isInvalidScopeError(400, '{"error":"invalid_client"}'), false);
  assert.equal(isInvalidScopeError(401, '{"error":"invalid_scope"}'), false);
});

test('hasPremierScope checks for the premier scope token', () => {
  assert.equal(hasPremierScope('basic premier'), true);
  assert.equal(hasPremierScope('basic'), false);
  assert.equal(hasPremierScope(null), false);
});

test('a Premier key gets the premier scope with one request', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint(['basic premier', 'basic']);
  const result = await fetchOAuth2Token('id', 'secret', OAUTH2_SCOPES, fetchImpl);
  assert.deepEqual(requested, ['basic premier']);
  assert.equal(result.scope, 'basic premier');
  assert.equal(result.accessToken, 'token-basic premier');
});

test('a free key falls back to basic when premier is refused with invalid_scope', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint(['basic']);
  const result = await fetchOAuth2Token('id', 'secret', OAUTH2_SCOPES, fetchImpl);
  assert.deepEqual(requested, ['basic premier', 'basic']);
  assert.equal(result.scope, 'basic');
});

test('other errors (e.g. wrong secret) fail without retrying', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint([], { status: 401, body: '{"error":"invalid_client"}' });
  await assert.rejects(fetchOAuth2Token('id', 'secret', OAUTH2_SCOPES, fetchImpl), /401/);
  assert.deepEqual(requested, ['basic premier']);
});

test('a remembered scope is requested alone and its refusal is reported', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint([]);
  await assert.rejects(fetchOAuth2Token('id', 'secret', ['basic'], fetchImpl), /400/);
  assert.deepEqual(requested, ['basic']);
});
