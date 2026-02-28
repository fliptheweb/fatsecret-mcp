import { z } from "zod";

export type get__food_barcode_findById_v2 = typeof get__food_barcode_findById_v2;
export const get__food_barcode_findById_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food/barcode/find-by-id/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      barcode: z.number().optional(),
      format: z.string().optional(),
      region: z.string().optional(),
      language: z.string().optional(),
      include_sub_categories: z.boolean().optional(),
      include_food_images: z.boolean().optional(),
      include_food_attributes: z.boolean().optional(),
      flag_default_serving: z.boolean().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__food_barcode_findById_v1 = typeof get__food_barcode_findById_v1;
export const get__food_barcode_findById_v1 = {
  method: z.literal("GET"),
  path: z.literal("/food/barcode/find-by-id/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      barcode: z.number().optional(),
      format: z.string().optional(),
      region: z.string().optional(),
      language: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__food_v5 = typeof get__food_v5;
export const get__food_v5 = {
  method: z.literal("GET"),
  path: z.literal("/food/v5"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      food_id: z.number().optional(),
      format: z.string().optional(),
      include_sub_categories: z.boolean().optional(),
      include_food_images: z.boolean().optional(),
      include_food_attributes: z.boolean().optional(),
      flag_default_serving: z.boolean().optional(),
      region: z.string().optional(),
      language: z.string().optional(),
      page_number: z.number().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__food_autocomplete_v2 = typeof get__food_autocomplete_v2;
export const get__food_autocomplete_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food/autocomplete/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      expression: z.string().optional(),
      format: z.string().optional(),
      max_results: z.number().optional(),
      region: z.string().optional(),
      language: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foods_search_v5 = typeof get__foods_search_v5;
export const get__foods_search_v5 = {
  method: z.literal("GET"),
  path: z.literal("/foods/search/v5"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search_expression: z.string().optional(),
      format: z.string().optional(),
      include_sub_categories: z.boolean().optional(),
      flag_default_serving: z.boolean().optional(),
      include_food_attributes: z.boolean().optional(),
      include_food_images: z.boolean().optional(),
      max_results: z.number().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
      page_number: z.number().optional(),
      food_type: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foods_search_v4 = typeof get__foods_search_v4;
export const get__foods_search_v4 = {
  method: z.literal("GET"),
  path: z.literal("/foods/search/v4"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search_expression: z.string().optional(),
      format: z.string().optional(),
      include_sub_categories: z.boolean().optional(),
      flag_default_serving: z.boolean().optional(),
      include_food_attributes: z.boolean().optional(),
      include_food_images: z.boolean().optional(),
      max_results: z.number().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
      page_number: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foods_search_v1 = typeof get__foods_search_v1;
export const get__foods_search_v1 = {
  method: z.literal("GET"),
  path: z.literal("/foods/search/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      search_expression: z.string().optional(),
      format: z.string().optional(),
      page_number: z.number().optional(),
      max_results: z.number().optional(),
      oauth_token: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__brands_v2 = typeof get__brands_v2;
export const get__brands_v2 = {
  method: z.literal("GET"),
  path: z.literal("/brands/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      starts_with: z.string().optional(),
      brand_type: z.string().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foodCategories_v2 = typeof get__foodCategories_v2;
export const get__foodCategories_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food-categories/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foodSubCategories_v2 = typeof get__foodSubCategories_v2;
export const get__foodSubCategories_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food-sub-categories/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      food_category_id: z.number().optional(),
      format: z.string().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__recipe_v2 = typeof get__recipe_v2;
export const get__recipe_v2 = {
  method: z.literal("GET"),
  path: z.literal("/recipe/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      recipe_id: z.number().optional(),
      format: z.string().optional(),
      page_number: z.number().optional(),
      max_results: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__recipes_search_v3 = typeof get__recipes_search_v3;
export const get__recipes_search_v3 = {
  method: z.literal("GET"),
  path: z.literal("/recipes/search/v3"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      page_number: z.number().optional(),
      max_results: z.number().optional(),
      search_expression: z.string().optional(),
      recipe_types: z.string().optional(),
      recipe_types_matchall: z.boolean().optional(),
      must_have_images: z.boolean().optional(),
      "calories.from": z.number().optional(),
      "calories.to": z.number().optional(),
      "carb_percentage.from": z.number().optional(),
      "carb_percentage.to": z.number().optional(),
      "protein_percentage.from": z.number().optional(),
      "protein_percentage.to": z.number().optional(),
      "fat_percentage.from": z.number().optional(),
      "fat_percentage.to": z.number().optional(),
      "prep_time.from": z.number().optional(),
      "prep_time.to": z.number().optional(),
      sort_by: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__recipeTypes_v2 = typeof get__recipeTypes_v2;
export const get__recipeTypes_v2 = {
  method: z.literal("GET"),
  path: z.literal("/recipe-types/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

