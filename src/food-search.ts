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
