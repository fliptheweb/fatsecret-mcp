import test from 'node:test';
import assert from 'node:assert/strict';

import { asArray, chooseServing, dayTotals, type Serving } from '../src/meal.js';

// Real servings of "Buckwheat Groats (Cooked, Roasted)" from /food/v5
const buckwheat: Serving[] = [
  { serving_id: '62421', serving_description: '100 g', measurement_description: 'g', number_of_units: '100.000', metric_serving_amount: '100.000', metric_serving_unit: 'g' },
  { serving_id: '40293', serving_description: '1 cup', measurement_description: 'cup', number_of_units: '1.000', metric_serving_amount: '168.000', metric_serving_unit: 'g' },
];

test('asArray normalizes FatSecret single-object lists', () => {
  assert.deepEqual(asArray({ a: 1 }), [{ a: 1 }]);
  assert.deepEqual(asArray([1, 2]), [1, 2]);
  assert.deepEqual(asArray(null), []);
});

test('grams use the per-gram serving, so units equal grams', () => {
  assert.deepEqual(chooseServing(buckwheat, { grams: 150 }), { serving_id: 62421, number_of_units: 150 });
});

test('grams fall back to another gram-based serving as a fraction of it', () => {
  assert.deepEqual(chooseServing([buckwheat[1]], { grams: 84 }), { serving_id: 40293, number_of_units: 0.5 });
});

test('grams without a gram-based serving explain which servings exist', () => {
  const ml: Serving[] = [{ serving_id: '1', serving_description: '1 glass', metric_serving_amount: '250', metric_serving_unit: 'ml' }];
  assert.throws(() => chooseServing(ml, { grams: 100 }), /pass serving_id instead.*1 \(1 glass\)/);
});

test('an explicit serving_id wins, default units 1', () => {
  assert.deepEqual(chooseServing(buckwheat, { serving_id: 40293, grams: 999 }), { serving_id: 40293, number_of_units: 1 });
});

test('no serving info picks the default serving', () => {
  const servings = [buckwheat[0], { ...buckwheat[1], is_default: '1' }];
  assert.deepEqual(chooseServing(servings, {}), { serving_id: 40293, number_of_units: 1 });
});

test('dayTotals sums calories and macros overall and per meal', () => {
  const response = {
    food_entries: {
      food_entry: [
        { meal: 'Breakfast', calories: '138', protein: '5.1', fat: '0.9', carbohydrate: '29.9' },
        { meal: 'Breakfast', calories: '70', protein: '6', fat: '5', carbohydrate: '0.5' },
        { meal: 'Lunch', calories: '300', protein: '20', fat: '10', carbohydrate: '30' },
      ],
    },
  };
  assert.deepEqual(dayTotals(response), {
    entries: 3,
    total: { calories: 508, protein: 31.1, fat: 15.9, carbohydrate: 60.4 },
    by_meal: {
      breakfast: { calories: 208, protein: 11.1, fat: 5.9, carbohydrate: 30.4 },
      lunch: { calories: 300, protein: 20, fat: 10, carbohydrate: 30 },
    },
  });
});

test('dayTotals handles an empty day and a single entry object', () => {
  assert.equal(dayTotals({ food_entries: null }).entries, 0);
  assert.equal(dayTotals({ food_entries: { food_entry: { meal: 'Dinner', calories: '10' } } }).total.calories, 10);
});
