/** Serving as returned by /food/v5 (all numbers come back as strings). */
export interface Serving {
  serving_id: string;
  serving_description?: string;
  measurement_description?: string;
  number_of_units?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  is_default?: string | null;
}

// FatSecret sends a single item as an object instead of a one-element array
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function describe(servings: Serving[]): string {
  return servings.map((s) => `${s.serving_id} (${s.serving_description})`).join(', ');
}

/**
 * Picks the serving and number_of_units for an item: an explicit serving_id wins; grams use a
 * gram-based serving (units = grams / metric amount × the serving's own number_of_units, so
 * "100 g" servings take grams and "1 cup" servings take cups); otherwise the default serving.
 */
export function chooseServing(
  servings: Serving[],
  item: { serving_id?: number; number_of_units?: number; grams?: number },
): { serving_id: number; number_of_units: number } {
  if (item.serving_id !== undefined) {
    return { serving_id: item.serving_id, number_of_units: item.number_of_units ?? 1 };
  }

  if (item.grams !== undefined) {
    const metric = servings.filter((s) => s.metric_serving_unit === 'g' && Number(s.metric_serving_amount) > 0);
    const serving = metric.find((s) => s.measurement_description === 'g') ?? metric[0];
    if (!serving) {
      throw new Error(`No gram-based serving for this food; pass serving_id instead. Servings: ${describe(servings)}`);
    }
    const units = (item.grams / Number(serving.metric_serving_amount)) * Number(serving.number_of_units || 1);
    return { serving_id: Number(serving.serving_id), number_of_units: round3(units) };
  }

  const serving = servings.find((s) => s.is_default === '1') ?? servings[0];
  if (!serving) throw new Error('Food has no servings');
  return { serving_id: Number(serving.serving_id), number_of_units: item.number_of_units ?? 1 };
}

const NUTRIENTS = ['calories', 'protein', 'fat', 'carbohydrate'] as const;

/** Sums calories and macros of a /food-entries/v2 response, overall and per meal. */
export function dayTotals(response: unknown) {
  const entries = asArray(
    (response as { food_entries?: { food_entry?: Record<string, string> | Record<string, string>[] } } | null)
      ?.food_entries?.food_entry,
  );
  const empty = () => Object.fromEntries(NUTRIENTS.map((n) => [n, 0])) as Record<(typeof NUTRIENTS)[number], number>;
  const total = empty();
  const byMeal: Record<string, ReturnType<typeof empty>> = {};
  for (const entry of entries) {
    const meal = (byMeal[entry.meal?.toLowerCase() ?? 'other'] ??= empty());
    for (const n of NUTRIENTS) {
      const v = Number(entry[n]) || 0;
      total[n] = round3(total[n] + v);
      meal[n] = round3(meal[n] + v);
    }
  }
  return { entries: entries.length, total, by_meal: byMeal };
}
