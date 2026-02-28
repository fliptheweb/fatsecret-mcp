import { z } from 'zod';

// ── Reusable fields ──

const RegionSchema = z.string().optional().describe('Region code (e.g. US, AU)');
const LanguageSchema = z.string().optional().describe('Language code (e.g. en, de)');
const PageNumberSchema = z.number().int().min(0).optional().describe('Zero-based page offset');
const MaxResultsSchema = z.number().int().min(1).max(50).optional().describe('Max results (max 50)');
const DateSchema = z.string().describe('Date in YYYY-MM-DD format');
const OptionalDateSchema = z.string().optional().describe('Date in YYYY-MM-DD format (default today)');
const MealSchema = z.enum(['breakfast', 'lunch', 'dinner', 'other']).describe('Meal type');
const OptionalMealSchema = MealSchema.optional();

// ── Public API – Foods ──

export const SearchFoodsInputSchema = z.object({
  search_expression: z.string().describe('Search query for foods'),
  page_number: PageNumberSchema,
  max_results: MaxResultsSchema,
  region: RegionSchema,
  language: LanguageSchema,
  food_type: z.enum(['none', 'generic', 'brand']).optional().describe('Filter by food type'),
  include_food_images: z.boolean().optional().describe('Include food images'),
  include_food_attributes: z.boolean().optional().describe('Include food attributes'),
  include_sub_categories: z.boolean().optional().describe('Include sub categories'),
  flag_default_serving: z.boolean().optional().describe('Flag default serving'),
});

export const GetFoodInputSchema = z.object({
  food_id: z.number().int().describe('Food ID'),
  region: RegionSchema,
  language: LanguageSchema,
  include_food_images: z.boolean().optional().describe('Include food images'),
  include_food_attributes: z.boolean().optional().describe('Include food attributes'),
  include_sub_categories: z.boolean().optional().describe('Include sub categories'),
  flag_default_serving: z.boolean().optional().describe('Flag default serving'),
});

export const FindFoodByBarcodeInputSchema = z.object({
  barcode: z.string().describe('GTIN-13 barcode number'),
  region: RegionSchema,
  language: LanguageSchema,
  include_food_images: z.boolean().optional().describe('Include food images'),
  include_food_attributes: z.boolean().optional().describe('Include food attributes'),
  include_sub_categories: z.boolean().optional().describe('Include sub categories'),
  flag_default_serving: z.boolean().optional().describe('Flag default serving'),
});

export const AutocompleteFoodsInputSchema = z.object({
  expression: z.string().describe('Partial search expression'),
  max_results: z.number().int().min(1).max(10).optional().describe('Max suggestions (default 4)'),
  region: RegionSchema,
  language: LanguageSchema,
});

// ── Public API – Recipes ──

export const SearchRecipesInputSchema = z.object({
  search_expression: z.string().optional().describe('Search query for recipes'),
  recipe_types: z.string().optional().describe('Comma-separated recipe type filter'),
  recipe_types_matchall: z.boolean().optional().describe('Match all recipe types'),
  must_have_images: z.boolean().optional().describe('Only recipes with images'),
  calories_from: z.number().optional().describe('Min calories (kcal)'),
  calories_to: z.number().optional().describe('Max calories (kcal)'),
  carb_percentage_from: z.number().optional().describe('Min carb percentage'),
  carb_percentage_to: z.number().optional().describe('Max carb percentage'),
  protein_percentage_from: z.number().optional().describe('Min protein percentage'),
  protein_percentage_to: z.number().optional().describe('Max protein percentage'),
  fat_percentage_from: z.number().optional().describe('Min fat percentage'),
  fat_percentage_to: z.number().optional().describe('Max fat percentage'),
  prep_time_from: z.number().optional().describe('Min prep time (minutes)'),
  prep_time_to: z.number().optional().describe('Max prep time (minutes)'),
  sort_by: z.enum(['newest', 'oldest', 'caloriesPerServingAscending', 'caloriesPerServingDescending']).optional(),
  page_number: PageNumberSchema,
  max_results: MaxResultsSchema,
});

export const GetRecipeInputSchema = z.object({
  recipe_id: z.number().int().describe('Recipe ID'),
});

// ── Public API – Reference Data ──

export const GetFoodCategoriesInputSchema = z.object({
  region: RegionSchema,
  language: LanguageSchema,
});

export const GetFoodSubCategoriesInputSchema = z.object({
  food_category_id: z.number().int().describe('Food category ID'),
  region: RegionSchema,
  language: LanguageSchema,
});

export const GetBrandsInputSchema = z.object({
  starts_with: z.string().optional().describe('Filter brands starting with letter'),
  brand_type: z.enum(['manufacturer', 'restaurant', 'supermarket']).optional().describe('Brand type'),
  region: RegionSchema,
  language: LanguageSchema,
});

export const GetRecipeTypesInputSchema = z.object({});

// ── Profile API – Food Diary ──

export const GetFoodEntriesInputSchema = z.object({
  date: OptionalDateSchema.describe('Date in YYYY-MM-DD (required if food_entry_id not specified)'),
  food_entry_id: z.number().int().optional().describe('Specific food entry ID'),
});

export const GetFoodEntriesMonthInputSchema = z.object({
  date: OptionalDateSchema.describe('Any date within the target month (YYYY-MM-DD)'),
});

export const CreateFoodEntryInputSchema = z.object({
  food_id: z.number().int().describe('Food ID'),
  food_entry_name: z.string().describe('Name for the food entry'),
  serving_id: z.number().int().describe('Serving size ID'),
  number_of_units: z.number().describe('Number of serving units'),
  meal: MealSchema,
  date: OptionalDateSchema,
});

export const EditFoodEntryInputSchema = z.object({
  food_entry_id: z.number().int().describe('Food entry ID to edit'),
  meal: OptionalMealSchema,
  food_entry_name: z.string().optional().describe('New name'),
  serving_id: z.number().int().optional().describe('New serving ID'),
  number_of_units: z.number().optional().describe('New number of units'),
});

export const DeleteFoodEntryInputSchema = z.object({
  food_entry_id: z.number().int().describe('Food entry ID to delete'),
});

export const CopyFoodEntriesInputSchema = z.object({
  from_date: z.string().describe('Source date YYYY-MM-DD'),
  to_date: z.string().describe('Target date YYYY-MM-DD'),
  meal: OptionalMealSchema,
});

export const CopySavedMealEntriesInputSchema = z.object({
  saved_meal_id: z.number().int().describe('Saved meal ID to copy'),
  meal: MealSchema,
  date: OptionalDateSchema,
});

// ── Profile API – Favorites ──

export const GetFavoriteFoodsInputSchema = z.object({});

export const DeleteFavoriteFoodInputSchema = z.object({
  food_id: z.number().int().describe('Food ID to remove from favorites'),
  serving_id: z.string().optional().describe('Serving ID (required if number_of_units present)'),
  number_of_units: z.string().optional().describe('Number of units (required if serving_id present)'),
});

export const GetMostEatenFoodsInputSchema = z.object({
  meal: OptionalMealSchema,
});

export const GetRecentlyEatenFoodsInputSchema = z.object({
  meal: OptionalMealSchema,
});

export const GetFavoriteRecipesInputSchema = z.object({});

export const AddFavoriteRecipeInputSchema = z.object({
  recipe_id: z.number().int().describe('Recipe ID to add to favorites'),
});

export const DeleteFavoriteRecipeInputSchema = z.object({
  recipe_id: z.number().int().describe('Recipe ID to remove from favorites'),
});

// ── Profile API – Saved Meals ──

export const GetSavedMealsInputSchema = z.object({
  meal: OptionalMealSchema.describe('Filter by meal type'),
});

export const CreateSavedMealInputSchema = z.object({
  saved_meal_name: z.string().describe('Meal name'),
  saved_meal_description: z.string().optional().describe('Description'),
  meals: z.string().optional().describe('Comma-separated meal types (breakfast, lunch, dinner, other)'),
});

export const EditSavedMealInputSchema = z.object({
  saved_meal_id: z.number().int().describe('Saved meal ID'),
  saved_meal_name: z.string().optional().describe('New name'),
  saved_meal_description: z.string().optional().describe('New description'),
  meals: z.string().optional().describe('Comma-separated meal types'),
});

export const DeleteSavedMealInputSchema = z.object({
  saved_meal_id: z.number().int().describe('Saved meal ID to delete'),
});

export const GetSavedMealItemsInputSchema = z.object({
  saved_meal_id: z.number().int().describe('Saved meal ID'),
});

export const AddSavedMealItemInputSchema = z.object({
  saved_meal_id: z.number().int().describe('Saved meal ID'),
  food_id: z.number().int().describe('Food ID to add'),
  saved_meal_item_name: z.string().describe('Item name'),
  serving_id: z.number().int().describe('Serving ID'),
  number_of_units: z.number().describe('Number of serving units'),
});

export const EditSavedMealItemInputSchema = z.object({
  saved_meal_item_id: z.number().int().describe('Saved meal item ID'),
  saved_meal_item_name: z.string().optional().describe('New name'),
  number_of_units: z.number().optional().describe('New number of units'),
});

export const DeleteSavedMealItemInputSchema = z.object({
  saved_meal_item_id: z.number().int().describe('Saved meal item ID to delete'),
});

// ── Profile API – Custom Food ──

export const CreateFoodInputSchema = z.object({
  brand_name: z.string().describe('Brand name'),
  food_name: z.string().describe('Food name'),
  serving_size: z.string().describe('Serving size description (e.g. "1 slice")'),
  calories: z.number().describe('Calories (kcal)'),
  fat: z.number().describe('Total fat (g)'),
  carbohydrate: z.number().describe('Total carbohydrate (g)'),
  protein: z.number().describe('Protein (g)'),
  serving_amount: z.string().optional().describe('Serving amount (decimal)'),
  serving_amount_unit: z.string().optional().describe('Serving amount unit'),
  saturated_fat: z.string().optional().describe('Saturated fat (g)'),
  polyunsaturated_fat: z.string().optional().describe('Polyunsaturated fat (g)'),
  monounsaturated_fat: z.string().optional().describe('Monounsaturated fat (g)'),
  trans_fat: z.string().optional().describe('Trans fat (g)'),
  cholesterol: z.string().optional().describe('Cholesterol (mg)'),
  sodium: z.string().optional().describe('Sodium (mg)'),
  potassium: z.string().optional().describe('Potassium (mg)'),
  fiber: z.string().optional().describe('Fiber (g)'),
  sugar: z.string().optional().describe('Sugar (g)'),
  added_sugars: z.string().optional().describe('Added sugars (g)'),
  vitamin_d: z.string().optional().describe('Vitamin D (mcg)'),
  vitamin_a: z.string().optional().describe('Vitamin A (mcg)'),
  vitamin_c: z.string().optional().describe('Vitamin C (mg)'),
  calcium: z.string().optional().describe('Calcium (mg)'),
  iron: z.string().optional().describe('Iron (mg)'),
});

// ── Profile API – Weight ──

export const UpdateWeightInputSchema = z.object({
  current_weight_kg: z.number().describe('Current weight in kg'),
  date: OptionalDateSchema,
  weight_type: z.enum(['kg', 'lb']).optional().describe('Weight unit (default kg)'),
  height_type: z.enum(['cm', 'inch']).optional().describe('Height unit (default cm)'),
  goal_weight_kg: z.number().optional().describe('Goal weight in kg'),
  current_height_cm: z.number().optional().describe('Height in cm (required for first weigh-in)'),
  comment: z.string().optional().describe('Comment for this entry'),
});

export const GetWeightMonthInputSchema = z.object({
  date: OptionalDateSchema.describe('Any date within the target month (YYYY-MM-DD)'),
});

// ── Profile API – Exercise ──

export const GetExercisesInputSchema = z.object({});

export const EditExerciseEntriesInputSchema = z.object({
  shift_to_id: z.number().int().describe('Exercise ID to shift time TO'),
  shift_from_id: z.number().int().describe('Exercise ID to shift time FROM'),
  minutes: z.number().int().describe('Minutes to shift'),
  shift_to_name: z.string().optional().describe('Name for shift-to exercise'),
  shift_from_name: z.string().optional().describe('Name for shift-from exercise'),
  kcal: z.number().optional().describe('Calories burned per minute'),
  date: OptionalDateSchema,
});

export const GetExerciseEntriesMonthInputSchema = z.object({
  date: OptionalDateSchema.describe('Any date within the target month (YYYY-MM-DD)'),
});

export const SaveExerciseTemplateInputSchema = z.object({
  days: z.number().int().describe('Days of week as bit flags (Sun=bit 1, Sat=bit 7), converted to int'),
  date: OptionalDateSchema,
});

// ── Profile ──

export const GetProfileInputSchema = z.object({});

// ── OAuth Flow ──

export const StartOAuthFlowInputSchema = z.object({});

export const CompleteOAuthFlowInputSchema = z.object({
  verifier: z.string().describe('OAuth verifier code from the authorization page'),
});

export const CheckAuthStatusInputSchema = z.object({});
