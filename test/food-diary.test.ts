import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGetFoodEntriesQuery, dateToDays, localDate, optionalDateToDays } from '../src/food-diary.js';

test('dateToDays converts YYYY-MM-DD to FatSecret date integer', () => {
  assert.equal(dateToDays('2026-06-17'), 20621);
});

test('buildGetFoodEntriesQuery omits placeholder food_entry_id=0 for date lookups', () => {
  assert.deepEqual(buildGetFoodEntriesQuery({ date: '2026-06-17', food_entry_id: 0 }), {
    date: 20621,
    format: 'json',
  });
});

test('buildGetFoodEntriesQuery preserves real food_entry_id lookups', () => {
  assert.deepEqual(buildGetFoodEntriesQuery({ food_entry_id: 23971997734 }), {
    food_entry_id: 23971997734,
    format: 'json',
  });
});

test('localDate uses the local calendar day, not UTC', () => {
  // 00:30 local time on Jan 2: UTC may still be Jan 1 east of Greenwich
  assert.equal(localDate(new Date(2026, 0, 2, 0, 30)), '2026-01-02');
});

test('optionalDateToDays defaults to local today', () => {
  assert.equal(optionalDateToDays(), dateToDays(localDate()));
  assert.equal(optionalDateToDays('2026-06-17'), 20621);
});

test('buildGetFoodEntriesQuery defaults a date lookup to local today', () => {
  assert.equal(buildGetFoodEntriesQuery({}).date, dateToDays(localDate()));
});
