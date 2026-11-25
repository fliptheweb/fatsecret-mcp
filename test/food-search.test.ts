import test from 'node:test';
import assert from 'node:assert/strict';

import { trimSearchServings, buildFoodsSearchV1Query, ignoredV1Options, isMissingScopeError } from '../src/food-search.js';

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

test('ignoredV1Options lists the set options v1 drops', () => {
  assert.deepEqual(
    ignoredV1Options({ search_expression: 'banana', max_results: 10, region: 'DE', language: undefined }),
    ['region'],
  );
  assert.deepEqual(ignoredV1Options({ search_expression: 'banana', page_number: 2 }), []);
});

test('trimSearchServings keeps calories and macros of each serving only', () => {
  const data = {
    foods_search: {
      results: {
        food: [
          { food_id: '1', servings: { serving: [{ serving_id: '7', calories: '92', protein: '3', iron: '0.8', sodium: '4' }] } },
          { food_id: '2', servings: { serving: { serving_id: '8', fat: '1', vitamin_c: '0' } } },
        ],
      },
    },
  };
  assert.deepEqual(trimSearchServings(data), {
    foods_search: {
      results: {
        food: [
          { food_id: '1', servings: { serving: [{ serving_id: '7', calories: '92', protein: '3' }] } },
          { food_id: '2', servings: { serving: { serving_id: '8', fat: '1' } } },
        ],
      },
    },
  });
});

test('trimSearchServings leaves v1 results and empty searches alone', () => {
  const v1 = { foods: { food: [{ food_id: '1', food_description: 'Per 100g - Calories: 92kcal' }] } };
  assert.deepEqual(trimSearchServings(v1), v1);
  assert.deepEqual(trimSearchServings({ foods_search: { results: null } }), { foods_search: { results: null } });
});
