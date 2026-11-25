import test from 'node:test';
import assert from 'node:assert/strict';

import { isApiError, result, toolResult } from '../src/response.ts';

test('isApiError detects FatSecret error payloads', () => {
  assert.equal(isApiError({ error: { code: 106, message: 'Invalid ID' } }), true);
  assert.equal(isApiError({ success: { value: '1' } }), false);
  assert.equal(isApiError(null), false);
  assert.equal(isApiError('error'), false);
});

test('toolResult flags FatSecret errors and transport failures', () => {
  assert.equal(toolResult({ error: { code: 13 } }).isError, true);
  assert.equal(toolResult('Bad Gateway', true).isError, true);
  assert.equal(toolResult({ success: { value: '1' } }).isError, undefined);
});

test('toolResult emits compact JSON and never "undefined"', () => {
  assert.equal(toolResult({ a: { b: 1 } }).content[0].text, '{"a":{"b":1}}');
  assert.equal(toolResult(undefined, true).content[0].text, 'null');
});

test('toolResult drops FatSecret link fields', () => {
  const text = toolResult({ food: { food_id: '1', food_url: 'https://x', servings: { serving: [{ serving_url: 'u', calories: '9' }] } } }).content[0].text;
  assert.equal(text, '{"food":{"food_id":"1","servings":{"serving":[{"calories":"9"}]}}}');
});

test('result uses data when present and flags a non-2xx error body', () => {
  assert.deepEqual(result({ data: { success: { value: '1' } } }), toolResult({ success: { value: '1' } }));
  assert.deepEqual(result({ error: 'Bad Gateway' }), toolResult('Bad Gateway', true));
});
