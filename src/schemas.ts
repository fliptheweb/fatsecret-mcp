import { z } from 'zod';
import * as pub from './generated/public-api.zod.js';
import * as profile from './generated/profile-api.zod.js';

// ── Reusable field overrides ──

const DateField = z.string().optional().describe('Date in YYYY-MM-DD format (default today)');
const RequiredDateField = z.string().describe('Date in YYYY-MM-DD format');
const MealField = z.enum(['breakfast', 'lunch', 'dinner', 'other']).describe('Meal type');

// ── Public API – Foods ──

export const SearchFoodsInputSchema = pub.get__foods_search_v5.parameters.shape.query
  .omit({ format: true })
  .extend({ search_expression: z.string().describe('Search query for foods') });

export const GetFoodInputSchema = pub.get__food_v5.parameters.shape.query
  .omit({ format: true })
  .extend({ food_id: z.number().int().describe('Food ID') });

export const FindFoodByBarcodeInputSchema = pub.get__food_barcode_findById_v2.parameters.shape.query
  .omit({ format: true })
  .extend({ barcode: z.string().describe('GTIN-13 barcode number') });

export const AutocompleteFoodsInputSchema = pub.get__food_autocomplete_v2.parameters.shape.query
  .omit({ format: true })
  .extend({ expression: z.string().describe('Partial search expression') });

// ── Public API – Recipes ──

export const SearchRecipesInputSchema = pub.get__recipes_search_v3.parameters.shape.query
  .omit({ format: true })
  .extend({ search_expression: z.string().optional().describe('Search query for recipes') });

export const GetRecipeInputSchema = pub.get__recipe_v2.parameters.shape.query
  .omit({ format: true })
  .extend({ recipe_id: z.number().int().describe('Recipe ID') });

// ── Public API – Reference Data ──

export const GetFoodCategoriesInputSchema = pub.get__foodCategories_v2.parameters.shape.query
  .omit({ format: true });

export const GetFoodSubCategoriesInputSchema = pub.get__foodSubCategories_v2.parameters.shape.query
  .omit({ format: true })
  .extend({ food_category_id: z.number().int().describe('Food category ID') });

export const GetBrandsInputSchema = pub.get__brands_v2.parameters.shape.query
  .omit({ format: true });

export const GetRecipeTypesInputSchema = z.object({});

// ── Profile API – Food Diary ──

export const GetFoodEntriesInputSchema = profile.get__foodEntries_v2.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({ date: DateField.describe('Date in YYYY-MM-DD (required if food_entry_id not specified)') });

export const GetFoodEntriesMonthInputSchema = profile.get__foodEntries_month_v2.parameters.shape.query
  .omit({ format: true, method: true, date: true })
  .extend({ date: DateField.describe('Any date within the target month (YYYY-MM-DD)') });

export const CreateFoodEntryInputSchema = profile.post__foodEntries_v1.parameters.shape.query
  .omit({ format: true, date: true, meal: true })
  .extend({
    food_id: z.number().int().describe('Food ID'),
    food_entry_name: z.string().describe('Name for the food entry'),
    serving_id: z.number().int().describe('Serving size ID'),
    number_of_units: z.number().describe('Number of serving units'),
    meal: MealField,
    date: DateField,
  });

export const EditFoodEntryInputSchema = profile.put__foodEntries_v1.parameters.shape.query
  .omit({ format: true, meal: true })
  .extend({
    food_entry_id: z.number().int().describe('Food entry ID to edit'),
    meal: MealField.optional(),
  });

export const DeleteFoodEntryInputSchema = profile.delete__foodEntries_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ food_entry_id: z.number().int().describe('Food entry ID to delete') });

export const CopyFoodEntriesInputSchema = profile.post__foodEntries_copy_v1.parameters.shape.query
  .omit({ format: true, from_date: true, to_date: true, meal: true })
  .extend({
    from_date: RequiredDateField.describe('Source date YYYY-MM-DD'),
    to_date: RequiredDateField.describe('Target date YYYY-MM-DD'),
    meal: MealField.optional(),
  });

export const CopySavedMealEntriesInputSchema = profile.post__foodEntries_copy_savedMeal_v1.parameters.shape.query
  .omit({ format: true, date: true, meal: true })
  .extend({
    saved_meal_id: z.number().int().describe('Saved meal ID to copy'),
    meal: MealField,
    date: DateField,
  });

// ── Profile API – Favorites ──

export const GetFavoriteFoodsInputSchema = z.object({});

export const DeleteFavoriteFoodInputSchema = profile.post__food_favorite_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ food_id: z.number().int().describe('Food ID to remove from favorites') });

export const GetMostEatenFoodsInputSchema = profile.get__food_mostEaten_v2.parameters.shape.query
  .omit({ format: true, meal: true })
  .extend({ meal: MealField.optional() });

export const GetRecentlyEatenFoodsInputSchema = profile.get__food_recentlyEaten_v2.parameters.shape.query
  .omit({ format: true, meal: true })
  .extend({ meal: MealField.optional() });

export const GetFavoriteRecipesInputSchema = z.object({});

export const AddFavoriteRecipeInputSchema = profile.post__recipe_favorites_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ recipe_id: z.number().int().describe('Recipe ID to add to favorites') });

export const DeleteFavoriteRecipeInputSchema = profile.delete__recipe_favorites_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ recipe_id: z.number().int().describe('Recipe ID to remove from favorites') });

// ── Profile API – Saved Meals ──

export const GetSavedMealsInputSchema = profile.get__savedMeals_v2.parameters.shape.query
  .omit({ format: true, meal: true })
  .extend({ meal: MealField.optional().describe('Filter by meal type') });

export const CreateSavedMealInputSchema = profile.post__savedMeals_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ saved_meal_name: z.string().describe('Meal name') });

export const EditSavedMealInputSchema = profile.put__savedMeals_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ saved_meal_id: z.number().int().describe('Saved meal ID') });

export const DeleteSavedMealInputSchema = profile.delete__savedMeals_v1.parameters.shape.query
  .omit({ format: true, method: true })
  .extend({ saved_meal_id: z.number().int().describe('Saved meal ID to delete') });

export const GetSavedMealItemsInputSchema = profile.get__savedMeals_item_v2.parameters.shape.query
  .omit({ format: true })
  .extend({ saved_meal_id: z.number().int().describe('Saved meal ID') });

export const AddSavedMealItemInputSchema = profile.post__savedMeals_item_v1.parameters.shape.query
  .omit({ format: true })
  .extend({
    saved_meal_id: z.number().int().describe('Saved meal ID'),
    food_id: z.number().int().describe('Food ID to add'),
    saved_meal_item_name: z.string().describe('Item name'),
    serving_id: z.number().int().describe('Serving ID'),
    number_of_units: z.number().describe('Number of serving units'),
  });

export const EditSavedMealItemInputSchema = profile.put__savedMeals_item_v1.parameters.shape.query
  .omit({ format: true })
  .extend({ saved_meal_item_id: z.number().int().describe('Saved meal item ID') });

export const DeleteSavedMealItemInputSchema = profile.delete__savedMeals_item_v1.parameters.shape.query
  .omit({ format: true, method: true })
  .extend({ saved_meal_item_id: z.number().int().describe('Saved meal item ID to delete') });

// ── Profile API – Custom Food ──

export const CreateFoodInputSchema = profile.post__food_v2.parameters.shape.query
  .omit({ format: true })
  .extend({
    brand_name: z.string().describe('Brand name'),
    food_name: z.string().describe('Food name'),
    serving_size: z.string().describe('Serving size description (e.g. "1 slice")'),
    calories: z.number().describe('Calories (kcal)'),
    fat: z.number().describe('Total fat (g)'),
    carbohydrate: z.number().describe('Total carbohydrate (g)'),
    protein: z.number().describe('Protein (g)'),
  });

// ── Profile API – Weight ──

export const UpdateWeightInputSchema = profile.post__weight_v1.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({
    current_weight_kg: z.number().describe('Current weight in kg'),
    date: DateField,
  });

export const GetWeightMonthInputSchema = profile.get__weight_month_v2.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({ date: DateField.describe('Any date within the target month (YYYY-MM-DD)') });

// ── Profile API – Exercise ──

export const GetExercisesInputSchema = z.object({});

export const EditExerciseEntriesInputSchema = profile.put__exerciseEntries_v1.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({
    shift_to_id: z.number().int().describe('Exercise ID to shift time TO'),
    shift_from_id: z.number().int().describe('Exercise ID to shift time FROM'),
    minutes: z.number().int().describe('Minutes to shift'),
    date: DateField,
  });

export const GetExerciseEntriesMonthInputSchema = profile.get__exerciseEntries_month_v2.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({ date: DateField.describe('Any date within the target month (YYYY-MM-DD)') });

export const SaveExerciseTemplateInputSchema = profile.post__exerciseEntries_day_v1.parameters.shape.query
  .omit({ format: true, date: true })
  .extend({
    days: z.number().int().describe('Days of week as bit flags (Sun=bit 1, Sat=bit 7), converted to int'),
    date: DateField,
  });

// ── Profile ──

export const GetProfileInputSchema = z.object({});

// ── OAuth Flow ──

export const SetupCredentialsInputSchema = z.object({
  client_id: z.string().describe('FatSecret Client ID (from platform.fatsecret.com → API Keys)'),
  client_secret: z.string().describe('FatSecret Client Secret (OAuth 2.0)'),
  consumer_secret: z.string().describe('FatSecret Consumer Secret (OAuth 1.0 — different from Client Secret, found on the same API Keys page)'),
});

export const StartAuthInputSchema = z.object({});

export const CompleteAuthInputSchema = z.object({
  verifier: z.string().describe('OAuth verifier code from the authorization page'),
});

export const CheckAuthStatusInputSchema = z.object({});
