import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFoodsSearchV1Query, isMissingScopeError } from '../src/food-search.ts';

test('isMissingScopeError detects the Basic plan response from /foods/search/v5', () => {
  assert.equal(isMissingScopeError({ error: { code: 14, message: 'Missing scope: premier' } }), true);
  assert.equal(isMissingScopeError({ error: { code: '14', message: 'Missing scope: premier' } }), true);
});

test('isMissingScopeError ignores other errors and normal results', () => {
  assert.equal(isMissingScopeError({ error: { code: 13, message: 'Invalid token' } }), false);
  assert.equal(isMissingScopeError({ foods_search: { results: { food: [] } } }), false);
  assert.equal(isMissingScopeError(undefined), false);
  assert.equal(isMissingScopeError(null), false);
});

test('buildFoodsSearchV1Query keeps only the parameters v1 accepts', () => {
  const args = {
    search_expression: 'banana',
    page_number: 1,
    max_results: 10,
    region: 'DE',
    language: 'de',
    food_type: 'generic',
    include_food_images: true,
  };
  assert.deepEqual(buildFoodsSearchV1Query(args), {
    search_expression: 'banana',
    page_number: 1,
    max_results: 10,
    format: 'json',
  });
});
