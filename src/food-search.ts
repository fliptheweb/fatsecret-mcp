/**
 * FatSecret error code 14 ("Missing scope"). /foods/search/v5 is Premier exclusive,
 * so Basic plan keys get this error back and have to use /foods/search/v1 instead.
 */
export const MISSING_SCOPE_ERROR_CODE = 14;

// The docs show error codes as strings ("code": "4"), the live API sends numbers – accept both
export function isMissingScopeError(data: unknown): boolean {
  const code = (data as { error?: { code?: unknown } } | null | undefined)?.error?.code;
  return Number(code) === MISSING_SCOPE_ERROR_CODE;
}

const V1_PARAMS = new Set(['search_expression', 'page_number', 'max_results']);

/** Options the caller set that /foods/search/v1 can't use, so the response can say they were ignored. */
export function ignoredV1Options(args: Record<string, unknown>): string[] {
  return Object.keys(args).filter((key) => args[key] !== undefined && !V1_PARAMS.has(key));
}

/**
 * /foods/search/v1 only accepts search_expression, page_number and max_results;
 * the v5-only options (region, language, food_type, ...) are dropped.
 */
export function buildFoodsSearchV1Query({
  search_expression,
  page_number,
  max_results,
}: {
  search_expression: string;
  page_number?: number;
  max_results?: number;
}) {
  return { search_expression, page_number, max_results, format: 'json' as const };
}

const SEARCH_SERVING_FIELDS = [
  'serving_id',
  'serving_description',
  'measurement_description',
  'number_of_units',
  'metric_serving_amount',
  'metric_serving_unit',
  'is_default',
  'calories',
  'protein',
  'fat',
  'carbohydrate',
];

/**
 * /foods/search/v5 returns every serving with ~20 micronutrients per food. Search only needs
 * enough to pick a food and serving, so servings keep calories and macros; get_food has the rest.
 */
export function trimSearchServings(data: unknown): unknown {
  const foods = (data as { foods_search?: { results?: { food?: unknown } | null } } | null)?.foods_search?.results?.food;
  if (!Array.isArray(foods)) return data;
  for (const food of foods as { servings?: { serving?: unknown } }[]) {
    const servings = food.servings?.serving;
    if (!servings) continue;
    const trim = (s: Record<string, unknown>) =>
      Object.fromEntries(SEARCH_SERVING_FIELDS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
    food.servings!.serving = Array.isArray(servings) ? servings.map(trim) : trim(servings as Record<string, unknown>);
  }
  return data;
}
