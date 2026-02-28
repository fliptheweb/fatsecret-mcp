import { z } from "zod";

export type post__food_v2 = typeof post__food_v2;
export const post__food_v2 = {
  method: z.literal("POST"),
  path: z.literal("/food/v2"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      brand_name: z.string().optional(),
      food_name: z.string().optional(),
      serving_size: z.string().optional(),
      calories: z.number().optional(),
      fat: z.number().optional(),
      carbohydrate: z.number().optional(),
      protein: z.number().optional(),
      format: z.string().optional(),
      serving_amount: z.string().optional(),
      serving_amount_unit: z.string().optional(),
      calories_from_fat: z.string().optional(),
      saturated_fat: z.string().optional(),
      polyunsaturated_fat: z.string().optional(),
      monounsaturated_fat: z.string().optional(),
      trans_fat: z.string().optional(),
      cholesterol: z.string().optional(),
      sodium: z.string().optional(),
      potassium: z.string().optional(),
      fiber: z.string().optional(),
      sugar: z.string().optional(),
      added_sugars: z.string().optional(),
      vitamin_d: z.string().optional(),
      vitamin_a: z.string().optional(),
      vitamin_c: z.string().optional(),
      calcium: z.string().optional(),
      iron: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__food_favorite_v1 = typeof post__food_favorite_v1;
export const post__food_favorite_v1 = {
  method: z.literal("POST"),
  path: z.literal("/food/favorite/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      food_id: z.number().optional(),
      format: z.string().optional(),
      serving_id: z.string().optional(),
      number_of_units: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__food_favorites_v2 = typeof get__food_favorites_v2;
export const get__food_favorites_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food/favorites/v2"),
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

export type get__food_mostEaten_v2 = typeof get__food_mostEaten_v2;
export const get__food_mostEaten_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food/most-eaten/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      meal: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__food_recentlyEaten_v2 = typeof get__food_recentlyEaten_v2;
export const get__food_recentlyEaten_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food/recently-eaten/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      meal: z.string().optional(),
    }),
    header: z.object({
      "Content-Type": z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__recipe_favorites_v1 = typeof post__recipe_favorites_v1;
export const post__recipe_favorites_v1 = {
  method: z.literal("POST"),
  path: z.literal("/recipe/favorites/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      recipe_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type delete__recipe_favorites_v1 = typeof delete__recipe_favorites_v1;
export const delete__recipe_favorites_v1 = {
  method: z.literal("DELETE"),
  path: z.literal("/recipe/favorites/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      recipe_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__recipe_favorites_v2 = typeof get__recipe_favorites_v2;
export const get__recipe_favorites_v2 = {
  method: z.literal("GET"),
  path: z.literal("/recipe/favorites/v2"),
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

export type post__savedMeals_v1 = typeof post__savedMeals_v1;
export const post__savedMeals_v1 = {
  method: z.literal("POST"),
  path: z.literal("/saved-meals/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      saved_meal_name: z.string().optional(),
      format: z.string().optional(),
      saved_meal_description: z.string().optional(),
      meals: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type put__savedMeals_v1 = typeof put__savedMeals_v1;
export const put__savedMeals_v1 = {
  method: z.literal("PUT"),
  path: z.literal("/saved-meals/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      saved_meal_id: z.number().optional(),
      format: z.string().optional(),
      saved_meal_name: z.string().optional(),
      saved_meal_description: z.string().optional(),
      meals: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type delete__savedMeals_v1 = typeof delete__savedMeals_v1;
export const delete__savedMeals_v1 = {
  method: z.literal("DELETE"),
  path: z.literal("/saved-meals/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      method: z.string().optional(),
      saved_meal_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__savedMeals_v2 = typeof get__savedMeals_v2;
export const get__savedMeals_v2 = {
  method: z.literal("GET"),
  path: z.literal("/saved-meals/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      meal: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__savedMeals_item_v1 = typeof post__savedMeals_item_v1;
export const post__savedMeals_item_v1 = {
  method: z.literal("POST"),
  path: z.literal("/saved-meals/item/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      saved_meal_id: z.number().optional(),
      food_id: z.number().optional(),
      saved_meal_item_name: z.string().optional(),
      serving_id: z.number().optional(),
      number_of_units: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type put__savedMeals_item_v1 = typeof put__savedMeals_item_v1;
export const put__savedMeals_item_v1 = {
  method: z.literal("PUT"),
  path: z.literal("/saved-meals/item/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      saved_meal_item_id: z.number().optional(),
      saved_meal_item_name: z.string().optional(),
      number_of_units: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type delete__savedMeals_item_v1 = typeof delete__savedMeals_item_v1;
export const delete__savedMeals_item_v1 = {
  method: z.literal("DELETE"),
  path: z.literal("/saved-meals/item/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      method: z.string().optional(),
      saved_meal_item_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__savedMeals_item_v2 = typeof get__savedMeals_item_v2;
export const get__savedMeals_item_v2 = {
  method: z.literal("GET"),
  path: z.literal("/saved-meals/item/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      saved_meal_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__profile_v1 = typeof post__profile_v1;
export const post__profile_v1 = {
  method: z.literal("POST"),
  path: z.literal("/profile/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      user_id: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__profile_v1 = typeof get__profile_v1;
export const get__profile_v1 = {
  method: z.literal("GET"),
  path: z.literal("/profile/v1"),
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

export type get__profile_auth_v1 = typeof get__profile_auth_v1;
export const get__profile_auth_v1 = {
  method: z.literal("GET"),
  path: z.literal("/profile/auth/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      user_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__foodEntries_copy_v1 = typeof post__foodEntries_copy_v1;
export const post__foodEntries_copy_v1 = {
  method: z.literal("POST"),
  path: z.literal("/food-entries/copy/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      from_date: z.number().optional(),
      to_date: z.number().optional(),
      format: z.string().optional(),
      meal: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__foodEntries_copy_savedMeal_v1 = typeof post__foodEntries_copy_savedMeal_v1;
export const post__foodEntries_copy_savedMeal_v1 = {
  method: z.literal("POST"),
  path: z.literal("/food-entries/copy/saved-meal/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      meal: z.string().optional(),
      saved_meal_id: z.number().optional(),
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foodEntries_v2 = typeof get__foodEntries_v2;
export const get__foodEntries_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food-entries/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      date: z.number().optional(),
      food_entry_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__foodEntries_month_v2 = typeof get__foodEntries_month_v2;
export const get__foodEntries_month_v2 = {
  method: z.literal("GET"),
  path: z.literal("/food-entries/month/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      method: z.string().optional(),
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__foodEntries_v1 = typeof post__foodEntries_v1;
export const post__foodEntries_v1 = {
  method: z.literal("POST"),
  path: z.literal("/food-entries/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      food_id: z.number().optional(),
      food_entry_name: z.string().optional(),
      serving_id: z.number().optional(),
      number_of_units: z.number().optional(),
      meal: z.string().optional(),
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type delete__foodEntries_v1 = typeof delete__foodEntries_v1;
export const delete__foodEntries_v1 = {
  method: z.literal("DELETE"),
  path: z.literal("/food-entries/v1"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      food_entry_id: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type put__foodEntries_v1 = typeof put__foodEntries_v1;
export const put__foodEntries_v1 = {
  method: z.literal("PUT"),
  path: z.literal("/food-entries/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      food_entry_id: z.number().optional(),
      meal: z.string().optional(),
      format: z.string().optional(),
      food_entry_name: z.string().optional(),
      serving_id: z.number().optional(),
      number_of_units: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__exerciseEntries_day_v1 = typeof post__exerciseEntries_day_v1;
export const post__exerciseEntries_day_v1 = {
  method: z.literal("POST"),
  path: z.literal("/exercise-entries/day/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      days: z.number().optional(),
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__exerciseEntries_month_v2 = typeof get__exerciseEntries_month_v2;
export const get__exerciseEntries_month_v2 = {
  method: z.literal("GET"),
  path: z.literal("/exercise-entries/month/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__exercises_v2 = typeof get__exercises_v2;
export const get__exercises_v2 = {
  method: z.literal("GET"),
  path: z.literal("/exercises/v2"),
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

export type put__exerciseEntries_v1 = typeof put__exerciseEntries_v1;
export const put__exerciseEntries_v1 = {
  method: z.literal("PUT"),
  path: z.literal("/exercise-entries/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      shift_to_id: z.number().optional(),
      shift_from_id: z.number().optional(),
      minutes: z.number().optional(),
      shift_to_name: z.string().optional(),
      shift_from_name: z.string().optional(),
      kcal: z.number().optional(),
      date: z.number().optional(),
      format: z.string().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type post__weight_v1 = typeof post__weight_v1;
export const post__weight_v1 = {
  method: z.literal("POST"),
  path: z.literal("/weight/v1"),
  requestFormat: z.literal("text"),
  parameters: z.object({
    query: z.object({
      current_weight_kg: z.number().optional(),
      format: z.string().optional(),
      date: z.number().optional(),
      weight_type: z.string().optional(),
      height_type: z.string().optional(),
      goal_weight_kg: z.number().optional(),
      comment: z.string().optional(),
      current_height_cm: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

export type get__weight_month_v2 = typeof get__weight_month_v2;
export const get__weight_month_v2 = {
  method: z.literal("GET"),
  path: z.literal("/weight/month/v2"),
  requestFormat: z.literal("json"),
  parameters: z.object({
    query: z.object({
      format: z.string().optional(),
      date: z.number().optional(),
    }),
  }),
  responses: z.object({
    "200": z.unknown(),
  }),
};

