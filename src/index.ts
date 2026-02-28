#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { buildOAuth1Headers, requestToken, accessToken, type OAuth1Credentials } from './oauth1.js';
import * as schemas from './schemas.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const BASE_URL = 'https://platform.fatsecret.com/rest';

// ── Helpers ──

function dateToDays(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / (1000 * 60 * 60 * 24));
}

function optionalDateToDays(dateStr?: string): number | undefined {
  return dateStr ? dateToDays(dateStr) : undefined;
}

function text(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ── Server ──

class FatSecretMcpServer {
  private server: McpServer;
  private clientId: string;
  private clientSecret: string;

  private oauth2Token: string | null = null;
  private oauth2TokenExpiry = 0;

  private oauth1Credentials: OAuth1Credentials;
  private pendingOAuth: { token: string; secret: string } | null = null;

  constructor() {
    this.clientId = process.env.FATSECRET_CLIENT_ID || '';
    this.clientSecret = process.env.FATSECRET_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.error('Missing FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET environment variables');
      process.exit(1);
    }

    this.oauth1Credentials = {
      consumerKey: this.clientId,
      consumerSecret: this.clientSecret,
    };
    this.loadOAuth1Tokens();

    this.server = new McpServer({ name: 'fatsecret-mcp', version });

    this.registerPublicFoodTools();
    this.registerPublicRecipeTools();
    this.registerPublicReferenceTools();
    this.registerFoodDiaryTools();
    this.registerFavoriteTools();
    this.registerSavedMealTools();
    this.registerWeightTools();
    this.registerExerciseTools();
    this.registerProfileTools();
    this.registerAuthTools();
  }

  // ── OAuth 2.0 Token ──

  private async getOAuth2Token(): Promise<string> {
    if (this.oauth2Token && Date.now() < this.oauth2TokenExpiry) {
      return this.oauth2Token;
    }

    const response = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'premier basic',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OAuth2 token request failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.oauth2Token = data.access_token;
    this.oauth2TokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.oauth2Token;
  }

  // ── OAuth 1.0 Config ──

  private getConfigDir(): string {
    return join(homedir(), '.fatsecret-mcp');
  }

  private getConfigPath(): string {
    return join(this.getConfigDir(), 'config.json');
  }

  private loadOAuth1Tokens(): void {
    try {
      const config = JSON.parse(readFileSync(this.getConfigPath(), 'utf-8'));
      if (config.accessToken && config.accessTokenSecret) {
        this.oauth1Credentials.accessToken = config.accessToken;
        this.oauth1Credentials.accessTokenSecret = config.accessTokenSecret;
      }
    } catch {
      // No config file yet
    }
  }

  private saveOAuth1Tokens(token: string, tokenSecret: string): void {
    const dir = this.getConfigDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.getConfigPath(), JSON.stringify({ accessToken: token, accessTokenSecret: tokenSecret }, null, 2));
    this.oauth1Credentials.accessToken = token;
    this.oauth1Credentials.accessTokenSecret = tokenSecret;
  }

  private ensureProfileAuth(): void {
    if (!this.oauth1Credentials.accessToken || !this.oauth1Credentials.accessTokenSecret) {
      throw new Error('Not authenticated for profile access. Use start_oauth_flow and complete_oauth_flow tools first.');
    }
  }

  // ── Public API – Foods ──

  private registerPublicFoodTools(): void {
    this.server.registerTool(
      'search_foods',
      {
        description: 'Search the FatSecret food database. Returns food names, descriptions, and basic nutrition info.',
        inputSchema: schemas.SearchFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/foods/search/v5', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_food',
      {
        description: 'Get detailed nutritional information for a specific food by ID. Returns servings, calories, macros, and micronutrients.',
        inputSchema: schemas.GetFoodInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/food/v5', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'find_food_by_barcode',
      {
        description: 'Find food by barcode (GTIN-13). UPC-A, EAN-13 and EAN-8 supported. Premier exclusive.',
        inputSchema: schemas.FindFoodByBarcodeInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ barcode, ...rest }) => {
        const { data } = await this.publicClient.GET('/food/barcode/find-by-id/v2', {
          params: { query: { barcode: Number(barcode), ...rest, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'autocomplete_foods',
      {
        description: 'Get autocomplete suggestions for a partial food search expression. Premier exclusive.',
        inputSchema: schemas.AutocompleteFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/food/autocomplete/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Public API – Recipes ──

  private registerPublicRecipeTools(): void {
    this.server.registerTool(
      'search_recipes',
      {
        description: 'Search recipes with optional filters for calories, macros, prep time, and recipe types.',
        inputSchema: schemas.SearchRecipesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({
        calories_from, calories_to,
        carb_percentage_from, carb_percentage_to,
        protein_percentage_from, protein_percentage_to,
        fat_percentage_from, fat_percentage_to,
        prep_time_from, prep_time_to,
        ...rest
      }) => {
        const { data } = await this.publicClient.GET('/recipes/search/v3', {
          params: {
            query: {
              ...rest,
              'calories.from': calories_from,
              'calories.to': calories_to,
              'carb_percentage.from': carb_percentage_from,
              'carb_percentage.to': carb_percentage_to,
              'protein_percentage.from': protein_percentage_from,
              'protein_percentage.to': protein_percentage_to,
              'fat_percentage.from': fat_percentage_from,
              'fat_percentage.to': fat_percentage_to,
              'prep_time.from': prep_time_from,
              'prep_time.to': prep_time_to,
              format: 'json',
            },
          },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_recipe',
      {
        description: 'Get detailed recipe information by ID including ingredients, directions, and nutrition.',
        inputSchema: schemas.GetRecipeInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/recipe/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Public API – Reference Data ──

  private registerPublicReferenceTools(): void {
    this.server.registerTool(
      'get_food_categories',
      {
        description: 'Get the full list of food categories. Premier exclusive.',
        inputSchema: schemas.GetFoodCategoriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/food-categories/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_food_sub_categories',
      {
        description: 'Get food sub categories for a given food category. Premier exclusive.',
        inputSchema: schemas.GetFoodSubCategoriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/food-sub-categories/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_brands',
      {
        description: 'Get the list of food brands, optionally filtered by starting letter and type. Premier exclusive.',
        inputSchema: schemas.GetBrandsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.publicClient.GET('/brands/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_recipe_types',
      {
        description: 'Get the full list of supported recipe type names.',
        inputSchema: schemas.GetRecipeTypesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const { data } = await this.publicClient.GET('/recipe-types/v2', {
          params: { query: { format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Food Diary ──

  private registerFoodDiaryTools(): void {
    this.server.registerTool(
      'get_food_entries',
      {
        description: 'Get food diary entries for a date or a specific entry by ID. Requires profile authentication.',
        inputSchema: schemas.GetFoodEntriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date, food_entry_id }) => {
        const { data } = await this.profileClient.GET('/food-entries/v2', {
          params: { query: { date: optionalDateToDays(date), food_entry_id, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_food_entries_month',
      {
        description: 'Get daily nutrition summary for a month. Returns calories and macros per day.',
        inputSchema: schemas.GetFoodEntriesMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) => {
        const { data } = await this.profileClient.GET('/food-entries/month/v2', {
          params: { query: { date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'create_food_entry',
      {
        description: 'Add a food diary entry. Requires food_id, serving_id, and meal type.',
        inputSchema: schemas.CreateFoodEntryInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) => {
        const { data } = await this.profileClient.POST('/food-entries/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'edit_food_entry',
      {
        description: 'Edit an existing food diary entry. Cannot change the date.',
        inputSchema: schemas.EditFoodEntryInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.PUT('/food-entries/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'delete_food_entry',
      {
        description: 'Delete a food diary entry by ID.',
        inputSchema: schemas.DeleteFoodEntryInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.DELETE('/food-entries/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'copy_food_entries',
      {
        description: 'Copy food entries from one date to another, optionally filtered by meal.',
        inputSchema: schemas.CopyFoodEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ from_date, to_date, meal }) => {
        const { data } = await this.profileClient.POST('/food-entries/copy/v1', {
          params: {
            query: {
              from_date: dateToDays(from_date),
              to_date: dateToDays(to_date),
              meal,
              format: 'json',
            },
          },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'copy_saved_meal_entries',
      {
        description: 'Copy entries from a saved meal to a meal on a specific date.',
        inputSchema: schemas.CopySavedMealEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) => {
        const { data } = await this.profileClient.POST('/food-entries/copy/saved-meal/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Favorites ──

  private registerFavoriteTools(): void {
    this.server.registerTool(
      'get_favorite_foods',
      {
        description: "Get the user's favorite foods.",
        inputSchema: schemas.GetFavoriteFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const { data } = await this.profileClient.GET('/food/favorites/v2', {
          params: { query: { format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'delete_favorite_food',
      {
        description: "Remove a food from the user's favorites.",
        inputSchema: schemas.DeleteFavoriteFoodInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.POST('/food/favorite/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_most_eaten_foods',
      {
        description: "Get the user's most eaten foods, optionally filtered by meal.",
        inputSchema: schemas.GetMostEatenFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.GET('/food/most-eaten/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_recently_eaten_foods',
      {
        description: "Get the user's recently eaten foods, optionally filtered by meal.",
        inputSchema: schemas.GetRecentlyEatenFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.GET('/food/recently-eaten/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_favorite_recipes',
      {
        description: "Get the user's favorite recipes.",
        inputSchema: schemas.GetFavoriteRecipesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const { data } = await this.profileClient.GET('/recipe/favorites/v2', {
          params: { query: { format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'add_favorite_recipe',
      {
        description: "Add a recipe to the user's favorites.",
        inputSchema: schemas.AddFavoriteRecipeInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.POST('/recipe/favorites/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'delete_favorite_recipe',
      {
        description: "Remove a recipe from the user's favorites.",
        inputSchema: schemas.DeleteFavoriteRecipeInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.DELETE('/recipe/favorites/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Saved Meals ──

  private registerSavedMealTools(): void {
    this.server.registerTool(
      'get_saved_meals',
      {
        description: "Get the user's saved meals, optionally filtered by meal type.",
        inputSchema: schemas.GetSavedMealsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.GET('/saved-meals/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'create_saved_meal',
      {
        description: 'Create a new saved meal.',
        inputSchema: schemas.CreateSavedMealInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) => {
        const { data } = await this.profileClient.POST('/saved-meals/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'edit_saved_meal',
      {
        description: 'Edit a saved meal name, description, or associated meals.',
        inputSchema: schemas.EditSavedMealInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.PUT('/saved-meals/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'delete_saved_meal',
      {
        description: 'Delete a saved meal.',
        inputSchema: schemas.DeleteSavedMealInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.DELETE('/saved-meals/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_saved_meal_items',
      {
        description: 'Get all food items in a saved meal.',
        inputSchema: schemas.GetSavedMealItemsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.GET('/saved-meals/item/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'add_saved_meal_item',
      {
        description: 'Add a food item to a saved meal.',
        inputSchema: schemas.AddSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) => {
        const { data } = await this.profileClient.POST('/saved-meals/item/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'edit_saved_meal_item',
      {
        description: 'Edit a food item in a saved meal (name or units). Cannot change serving_id.',
        inputSchema: schemas.EditSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.PUT('/saved-meals/item/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'delete_saved_meal_item',
      {
        description: 'Remove a food item from a saved meal.',
        inputSchema: schemas.DeleteSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) => {
        const { data } = await this.profileClient.DELETE('/saved-meals/item/v1', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Weight ──

  private registerWeightTools(): void {
    this.server.registerTool(
      'update_weight',
      {
        description: "Record the user's weight for a date. First weigh-in requires goal_weight_kg and current_height_cm.",
        inputSchema: schemas.UpdateWeightInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ date, ...rest }) => {
        const { data } = await this.profileClient.POST('/weight/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_weight_month',
      {
        description: "Get the user's weight entries for a month.",
        inputSchema: schemas.GetWeightMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) => {
        const { data } = await this.profileClient.GET('/weight/month/v2', {
          params: { query: { date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Exercise ──

  private registerExerciseTools(): void {
    this.server.registerTool(
      'get_exercises',
      {
        description: 'Get the full list of supported exercise types and their IDs.',
        inputSchema: schemas.GetExercisesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const { data } = await this.profileClient.GET('/exercises/v2', {
          params: { query: { format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'edit_exercise_entries',
      {
        description: 'Shift exercise time between activities for a date. Moves minutes from one exercise to another.',
        inputSchema: schemas.EditExerciseEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) => {
        const { data } = await this.profileClient.PUT('/exercise-entries/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'get_exercise_entries_month',
      {
        description: 'Get daily calories expended from exercise for a month.',
        inputSchema: schemas.GetExerciseEntriesMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) => {
        const { data } = await this.profileClient.GET('/exercise-entries/month/v2', {
          params: { query: { date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'save_exercise_template',
      {
        description: "Save the current day's exercise entries as a template for specified days of the week.",
        inputSchema: schemas.SaveExerciseTemplateInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ date, ...rest }) => {
        const { data } = await this.profileClient.POST('/exercise-entries/day/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date), format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Profile API – Profile & Custom Food ──

  private registerProfileTools(): void {
    this.server.registerTool(
      'get_profile',
      {
        description: 'Get profile status information for the authenticated user.',
        inputSchema: schemas.GetProfileInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const { data } = await this.profileClient.GET('/profile/v1', {
          params: { query: { format: 'json' } },
        });
        return text(data);
      },
    );

    this.server.registerTool(
      'create_food',
      {
        description: 'Create a custom food with nutrition info. Premier exclusive.',
        inputSchema: schemas.CreateFoodInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) => {
        const { data } = await this.profileClient.POST('/food/v2', {
          params: { query: { ...args, format: 'json' } },
        });
        return text(data);
      },
    );
  }

  // ── Auth Tools ──

  private registerAuthTools(): void {
    this.server.registerTool(
      'start_oauth_flow',
      {
        description: 'Start the OAuth 1.0 authorization flow for profile access. Returns an authorization URL the user must visit.',
        inputSchema: schemas.StartOAuthFlowInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false },
      },
      async () => {
        const result = await requestToken(this.oauth1Credentials);
        this.pendingOAuth = { token: result.oauthToken, secret: result.oauthTokenSecret };
        return text({
          message: 'Visit the URL below to authorize the app, then use complete_oauth_flow with the verifier code.',
          authorization_url: result.authorizationUrl,
        });
      },
    );

    this.server.registerTool(
      'complete_oauth_flow',
      {
        description: 'Complete the OAuth 1.0 flow with the verifier code from the authorization page.',
        inputSchema: schemas.CompleteOAuthFlowInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ verifier }) => {
        if (!this.pendingOAuth) {
          throw new Error('No pending OAuth flow. Call start_oauth_flow first.');
        }
        const result = await accessToken(
          this.oauth1Credentials,
          this.pendingOAuth.token,
          this.pendingOAuth.secret,
          verifier,
        );
        this.saveOAuth1Tokens(result.accessToken, result.accessTokenSecret);
        this.pendingOAuth = null;
        return text({
          message: 'Authentication successful! Profile tools are now available.',
          config_path: this.getConfigPath(),
        });
      },
    );

    this.server.registerTool(
      'check_auth_status',
      {
        description: 'Check if OAuth 1.0 profile authentication is configured.',
        inputSchema: schemas.CheckAuthStatusInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const hasTokens = !!(this.oauth1Credentials.accessToken && this.oauth1Credentials.accessTokenSecret);
        return text({
          authenticated: hasTokens,
          config_path: this.getConfigPath(),
          config_exists: existsSync(this.getConfigPath()),
          message: hasTokens
            ? 'Profile authentication is configured. All tools are available.'
            : 'Not authenticated for profile access. Use start_oauth_flow to begin.',
        });
      },
    );
  }

  // ── Run ──

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('FatSecret MCP server running on stdio');
  }
}

const server = new FatSecretMcpServer();
server.run().catch(console.error);
