import test from 'node:test';
import assert from 'node:assert/strict';

import { hasPremierScope, hasScope, isInvalidScopeError, fetchOAuth2Token, detectOAuth2Token } from '../src/oauth2.ts';

const ALL = 'basic premier barcode nlp image-recognition';

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

test('hasScope matches whole scope names only', () => {
  assert.equal(hasScope('basic premier barcode', 'barcode'), true);
  assert.equal(hasScope('basic premier', 'barcode'), false);
  assert.equal(hasScope(null, 'basic'), false);
});

test('a key with every scope gets them all with one request', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint([ALL]);
  const result = await detectOAuth2Token('id', 'secret', fetchImpl);
  assert.deepEqual(requested, [ALL]);
  assert.equal(result.scope, ALL);
});

test('a Premier key without add-ons keeps only the scopes it was granted', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint(['basic premier', 'basic barcode', 'basic premier barcode']);
  const result = await detectOAuth2Token('id', 'secret', fetchImpl);
  assert.deepEqual(requested, [
    ALL,
    'basic premier',
    'basic barcode',
    'basic nlp',
    'basic image-recognition',
    'basic premier barcode',
  ]);
  assert.equal(result.scope, 'basic premier barcode');
  assert.equal(result.accessToken, 'token-basic premier barcode');
});

test('a free key falls back to basic', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint(['basic']);
  const result = await detectOAuth2Token('id', 'secret', fetchImpl);
  assert.equal(result.scope, 'basic');
  assert.equal(requested.at(-1), 'basic');
});

test('other errors (e.g. wrong secret) fail without probing', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint([], { status: 401, body: '{"error":"invalid_client"}' });
  await assert.rejects(detectOAuth2Token('id', 'secret', fetchImpl), /401/);
  assert.deepEqual(requested, [ALL]);
});

test('a remembered scope is requested alone and its refusal is reported', async () => {
  const { fetchImpl, requested } = fakeTokenEndpoint([]);
  await assert.rejects(fetchOAuth2Token('id', 'secret', ['basic'], fetchImpl), /400/);
  assert.deepEqual(requested, ['basic']);
});
