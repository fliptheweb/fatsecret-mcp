#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths as PublicPaths } from './generated/public-api.js';
import type { paths as ProfilePaths } from './generated/profile-api.js';
import { buildGetFoodEntriesQuery, dateToDays, optionalDateToDays } from './food-diary.js';
import { buildFoodsSearchV1Query, ignoredV1Options, isMissingScopeError, trimSearchServings } from './food-search.js';
import { buildOAuth1Params, requestToken, accessToken, type OAuth1Credentials } from './oauth1.js';
import { detectOAuth2Token, fetchOAuth2Token, hasPremierScope, hasScope } from './oauth2.js';
import { resolveImageB64 } from './image.js';
import { asArray, chooseServing, dayTotals, type Serving } from './meal.js';
import { result, toolResult } from './response.js';
import * as schemas from './schemas.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const BASE_URL = 'https://platform.fatsecret.com/rest';


// ── Config ──

interface Config {
  clientId?: string;
  clientSecret?: string;
  consumerSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

// ── Server ──

class FatSecretMcpServer {
  private server: McpServer;
  private clientId = '';
  private clientSecret = '';

  private oauth2Token: string | null = null;
  private oauth2TokenExpiry = 0;
  // Scopes the key was granted (e.g. "basic premier barcode"); null until the first token request
  private oauth2Scope: string | null = null;
  private oauth2Pending: Promise<string> | null = null;

  private publicClient: ReturnType<typeof createClient<PublicPaths>>;
  private profileClient: ReturnType<typeof createClient<ProfilePaths>>;

  private oauth1Credentials: OAuth1Credentials;
  private pendingOAuth: { token: string; secret: string } | null = null;

  constructor() {
    this.oauth1Credentials = { consumerKey: '', consumerSecret: '' };

    // Load config: persistent file first, env vars override
    this.loadConfig();

    // Public API client with OAuth 2.0
    this.publicClient = createClient<PublicPaths>({ baseUrl: BASE_URL });
    const oauth2Middleware: Middleware = {
      onRequest: async ({ request }) => {
        const token = await this.getOAuth2Token();
        const url = new URL(request.url);
        url.searchParams.set('format', 'json');
        const authorized = new Request(url.toString(), request);
        authorized.headers.set('Authorization', `Bearer ${token}`);
        return authorized;
      },
    };
    this.publicClient.use(oauth2Middleware);

    // Profile API client with OAuth 1.0 (params in query string, not Authorization header)
    this.profileClient = createClient<ProfilePaths>({ baseUrl: BASE_URL });
    const oauth1Middleware: Middleware = {
      onRequest: async ({ request }) => {
        this.ensureProfileAuth();
        const url = new URL(request.url);
        url.searchParams.set('format', 'json');
        const existingParams: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { existingParams[k] = v; });
        const allParams = buildOAuth1Params(request.method, `${url.origin}${url.pathname}`, this.oauth1Credentials, existingParams);
        url.search = new URLSearchParams(allParams).toString();
        return new Request(url.toString(), request);
      },
    };
    this.profileClient.use(oauth1Middleware);

    this.server = new McpServer(
      { name: 'fatsecret-mcp', version },
      {
        instructions: [
          'FatSecret MCP server provides two levels of access:',
          '',
          '1. SETUP: If API credentials are not configured, call check_auth_status first.',
          '   It will tell you if credentials are missing and guide through setup_credentials.',
          '   Get credentials at https://platform.fatsecret.com/ → My Account → API Keys.',
          '',
          '2. PUBLIC API (works after setup): Food search, recipes, brands, categories.',
          '   These tools use OAuth 2.0 with the configured Client ID and Client Secret.',
          '',
          '3. PROFILE API (requires user authorization): Food diary, saved meals, favorites, weight, exercises, profile.',
          '   These tools require OAuth 1.0 user authorization. Before using any profile tool,',
          '   call check_auth_status to see if the user is authenticated.',
          '   If not, guide them through: start_auth → user visits URL and authorizes → complete_auth with verifier PIN.',
          '   All credentials and tokens persist across sessions in ~/.fatsecret-mcp/config.json.',
        ].join('\n'),
      },
    );

    this.registerPublicFoodTools();
    this.registerRecognitionTools();
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

  // ── Config Management ──

  private getConfigDir(): string {
    return join(homedir(), '.fatsecret-mcp');
  }

  private getConfigPath(): string {
    return join(this.getConfigDir(), 'config.json');
  }

  private loadConfig(): void {
    // 1. Load from persistent config file
    let fileConfig: Config = {};
    try {
      fileConfig = JSON.parse(readFileSync(this.getConfigPath(), 'utf-8')) as Config;
      console.error(`Loaded config from ${this.getConfigPath()}`);
    } catch {
      console.error(`No config file at ${this.getConfigPath()}`);
    }

    // 2. Apply: env vars override config file
    this.clientId = process.env.FATSECRET_CLIENT_ID || fileConfig.clientId || '';
    this.clientSecret = process.env.FATSECRET_CLIENT_SECRET || fileConfig.clientSecret || '';
    const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET || fileConfig.consumerSecret || '';

    this.oauth1Credentials = {
      consumerKey: this.clientId,
      consumerSecret,
      accessToken: fileConfig.accessToken,
      accessTokenSecret: fileConfig.accessTokenSecret,
    };

    // 3. Log credential sources
    const src = (envKey: string, fileVal?: string) => {
      if (process.env[envKey]) return `env(${envKey})`;
      if (fileVal) return 'config file';
      return 'not set';
    };
    console.error(`Credentials: clientId=${src('FATSECRET_CLIENT_ID', fileConfig.clientId)}, clientSecret=${src('FATSECRET_CLIENT_SECRET', fileConfig.clientSecret)}, consumerSecret=${src('FATSECRET_CONSUMER_SECRET', fileConfig.consumerSecret)}`);
    console.error(`OAuth 1.0 tokens: ${fileConfig.accessToken ? 'loaded from config file' : 'not set'}`);
  }

  private saveConfig(updates: Partial<Config>): void {
    const dir = this.getConfigDir();
    mkdirSync(dir, { recursive: true });

    // Read existing config, merge updates
    let existing: Config = {};
    try {
      existing = JSON.parse(readFileSync(this.getConfigPath(), 'utf-8')) as Config;
    } catch {
      // No existing config
    }

    const merged = { ...existing, ...updates };
    // Remove keys explicitly set to undefined
    for (const key of Object.keys(merged) as (keyof Config)[]) {
      if (merged[key] === undefined) delete merged[key];
    }
    writeFileSync(this.getConfigPath(), JSON.stringify(merged, null, 2));
    console.error(`Saved config to ${this.getConfigPath()}`);
  }

  private hasApiCredentials(): boolean {
    return !!(this.clientId && this.clientSecret && this.oauth1Credentials.consumerSecret);
  }

  private ensureApiCredentials(): void {
    if (!this.hasApiCredentials()) {
      throw new Error(
        'API credentials not configured. Use setup_credentials tool first. ' +
        'Get your credentials at https://platform.fatsecret.com/ → My Account → API Keys.',
      );
    }
  }

  // ── OAuth 2.0 Token ──

  private async getOAuth2Token(): Promise<string> {
    this.ensureApiCredentials();

    if (this.oauth2Token && Date.now() < this.oauth2TokenExpiry) {
      return this.oauth2Token;
    }

    // Concurrent tool calls share one token request
    this.oauth2Pending ??= this.requestOAuth2Token().finally(() => {
      this.oauth2Pending = null;
    });
    return this.oauth2Pending;
  }

  private async requestOAuth2Token(): Promise<string> {
    // After the first token we know which scope the key is entitled to, so refreshes take one request
    const { accessToken: token, expiresIn, scope } = this.oauth2Scope
      ? await fetchOAuth2Token(this.clientId, this.clientSecret, [this.oauth2Scope])
      : await detectOAuth2Token(this.clientId, this.clientSecret);
    this.oauth2Scope = scope;
    this.oauth2Token = token;
    this.oauth2TokenExpiry = Date.now() + (expiresIn - 60) * 1000;
    return token;
  }

  private ensureProfileAuth(): void {
    this.ensureApiCredentials();
    if (!this.oauth1Credentials.accessToken || !this.oauth1Credentials.accessTokenSecret) {
      throw new Error(
        'Not authenticated for profile access. Use check_auth_status to check, then start_auth and complete_auth to authorize.',
      );
    }
  }

  // ── Endpoints missing from the generated Postman types ──

  private static async parseJson(response: Response): Promise<unknown> {
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      return { error: { status: response.status, message: body } };
    }
  }

  // POST a JSON body with the OAuth 2.0 token (NLP, image recognition)
  private async postPublicJson(path: string, body: unknown): Promise<unknown> {
    const token = await this.getOAuth2Token();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return FatSecretMcpServer.parseJson(response);
  }

  // Profile call signed with OAuth 1.0, params in the query string like profileClient
  private async profileRequest(method: string, path: string, query: Record<string, unknown> = {}): Promise<unknown> {
    this.ensureProfileAuth();
    const url = `${BASE_URL}${path}`;
    const params: Record<string, string> = { format: 'json' };
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params[key] = String(value);
    }
    const signed = buildOAuth1Params(method, url, this.oauth1Credentials, params);
    const response = await fetch(`${url}?${new URLSearchParams(signed)}`, { method });
    return FatSecretMcpServer.parseJson(response);
  }

  // Add-ons are separate OAuth2 scopes; say so up front instead of a bare "Missing scope"
  private async ensureScope(scope: string, feature: string): Promise<void> {
    await this.getOAuth2Token();
    if (!hasScope(this.oauth2Scope, scope)) {
      throw new Error(
        `${feature} is not enabled for this FatSecret key (granted scopes: ${this.oauth2Scope}). ` +
          'It is a paid add-on: enable it at https://platform.fatsecret.com/ and restart the server.',
      );
    }
  }

  // ── Public API – Foods ──

  private registerPublicFoodTools(): void {
    this.server.registerTool(
      'search_foods',
      {
        description: 'Search the FatSecret food database. Returns food names and servings with calories and macros (use get_food for micronutrients). On the Basic plan only search_expression, page_number and max_results (max 50) are used.',
        inputSchema: schemas.SearchFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) => {
        // v5 is Premier exclusive, so the granted token scope decides which endpoint to call
        await this.getOAuth2Token();
        if (hasPremierScope(this.oauth2Scope)) {
          const { data, error } = await this.publicClient.GET('/foods/search/v5', {
            params: { query: args },
          });
          // Safety net: if v5 still answers "Missing scope", use v1 below
          if (!isMissingScopeError(data)) return toolResult(trimSearchServings(data) ?? error, data === undefined);
        }
        const { data, error } = await this.publicClient.GET('/foods/search/v1', {
          params: { query: buildFoodsSearchV1Query(args) },
        });
        const ignored = ignoredV1Options(args);
        if (data === undefined) return toolResult(error, true);
        return toolResult(ignored.length ? { ...(data as object), note: `Basic plan: ${ignored.join(', ')} ignored` } : data);
      },
    );

    this.server.registerTool(
      'get_food',
      {
        description: 'Get detailed nutritional information for a specific food by ID. Returns servings, calories, macros, and micronutrients.',
        inputSchema: schemas.GetFoodInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) =>
        result(await this.publicClient.GET('/food/v5', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'find_food_by_barcode',
      {
        description: 'Find food by barcode (GTIN-13). UPC-A, EAN-13 and EAN-8 supported. Needs the "barcode" scope (Premier).',
        inputSchema: schemas.FindFoodByBarcodeInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ barcode, ...rest }) =>
        result(await this.publicClient.GET('/food/barcode/find-by-id/v2', {
          params: { query: { barcode: Number(barcode), ...rest } },
        })),
    );

    this.server.registerTool(
      'autocomplete_foods',
      {
        description: 'Get autocomplete suggestions for a partial food search expression. Premier exclusive.',
        inputSchema: schemas.AutocompleteFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) =>
        result(await this.publicClient.GET('/food/autocomplete/v2', {
          params: { query: args },
        })),
    );
  }

  // ── Public API – Natural Language Processing & Image Recognition ──

  private registerRecognitionTools(): void {
    this.server.registerTool(
      'parse_food_text',
      {
        description:
          'Turn a free-text meal description ("2 eggs and a slice of toast") into matched FatSecret foods with ' +
          'suggested servings and nutrition, ready for create_food_entry. Paid NLP add-on ("nlp" scope).',
        inputSchema: schemas.ParseFoodTextInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ include_food_data = true, ...rest }) => {
        await this.ensureScope('nlp', 'Natural language processing');
        return toolResult(await this.postPublicJson('/natural-language-processing/v1', { include_food_data, ...rest }));
      },
    );

    this.server.registerTool(
      'recognize_food_image',
      {
        description:
          'Recognize foods in a meal photo and match them to FatSecret foods with suggested servings and nutrition, ' +
          'ready for create_food_entry. Pass image_path (local file) or image_b64. ' +
          'Paid image recognition add-on ("image-recognition" scope).',
        inputSchema: schemas.RecognizeFoodImageInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ image_path, image_b64, include_food_data = true, ...rest }) => {
        await this.ensureScope('image-recognition', 'Image recognition');
        const body = { image_b64: resolveImageB64({ image_path, image_b64 }), include_food_data, ...rest };
        return toolResult(await this.postPublicJson('/image-recognition/v2', body));
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
      async (args) =>
        result(await this.publicClient.GET('/recipes/search/v3', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_recipe',
      {
        description: 'Get detailed recipe information by ID including ingredients, directions, and nutrition.',
        inputSchema: schemas.GetRecipeInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (args) =>
        result(await this.publicClient.GET('/recipe/v2', {
          params: { query: args },
        })),
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
      async (args) =>
        result(await this.publicClient.GET('/food-categories/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_food_sub_categories',
      {
        description: 'Get food sub categories for a given food category. Premier exclusive.',
        inputSchema: schemas.GetFoodSubCategoriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.publicClient.GET('/food-sub-categories/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_brands',
      {
        description: 'Get the list of food brands, optionally filtered by starting letter and type. Premier exclusive.',
        inputSchema: schemas.GetBrandsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.publicClient.GET('/brands/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_recipe_types',
      {
        description: 'Get the full list of supported recipe type names.',
        inputSchema: schemas.GetRecipeTypesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () =>
        result(await this.publicClient.GET('/recipe-types/v2')),
    );
  }

  // ── Profile API – Food Diary ──

  private registerFoodDiaryTools(): void {
    this.server.registerTool(
      'get_food_entries',
      {
        description: 'Get food diary entries for a date or a specific entry by ID. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetFoodEntriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.GET('/food-entries/v2', {
          params: { query: buildGetFoodEntriesQuery({ ...rest, date }) },
        })),
    );

    this.server.registerTool(
      'get_food_entries_month',
      {
        description: 'Get daily nutrition summary for a month. Returns calories and macros per day. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetFoodEntriesMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) =>
        result(await this.profileClient.GET('/food-entries/month/v2', {
          params: { query: { date: optionalDateToDays(date) } },
        })),
    );

    this.server.registerTool(
      'create_food_entry',
      {
        description: 'Add a food diary entry. Requires food_id, serving_id, and meal type. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.CreateFoodEntryInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.POST('/food-entries/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date) } },
        })),
    );

    this.server.registerTool(
      'log_meal',
      {
        description:
          'Log a whole meal in one call: each item is a food_id plus grams (or serving_id + number_of_units); ' +
          'servings are resolved automatically. Returns the created entries and the day totals. ' +
          'Prefer this over several create_food_entry calls. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.LogMealInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ meal, date, items }) => {
        const days = optionalDateToDays(date);
        const created: unknown[] = [];
        const failed: unknown[] = [];

        // One item at a time: a failure is reported per item and the rest still gets logged
        for (const item of items) {
          try {
            let name = item.food_entry_name;
            let serving: { serving_id: number; number_of_units: number };
            if (item.serving_id !== undefined && name) {
              serving = chooseServing([], item);
            } else {
              const { data, error } = await this.publicClient.GET('/food/v5', {
                params: { query: { food_id: item.food_id } },
              });
              const food = (data as { food?: { food_name: string; servings?: { serving?: Serving | Serving[] } } })?.food;
              if (!food) throw new Error(JSON.stringify(data ?? error));
              name ??= food.food_name;
              serving = chooseServing(asArray(food.servings?.serving), item);
            }

            const { data, error } = await this.profileClient.POST('/food-entries/v1', {
              params: {
                query: { food_id: item.food_id, food_entry_name: name, ...serving, meal, date: days },
              },
            });
            const entryId = (data as { food_entry_id?: { value?: string } })?.food_entry_id?.value;
            if (!entryId) throw new Error(JSON.stringify(data ?? error));
            created.push({ food_entry_id: Number(entryId), food_entry_name: name, ...serving });
          } catch (err) {
            failed.push({ food_id: item.food_id, error: err instanceof Error ? err.message : String(err) });
          }
        }

        const { data: day } = await this.profileClient.GET('/food-entries/v2', {
          params: { query: { date: days } },
        });
        return toolResult({ created, failed, day_totals: dayTotals(day) }, failed.length > 0);
      },
    );

    this.server.registerTool(
      'edit_food_entry',
      {
        description: 'Edit an existing food diary entry. Cannot change the date. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.EditFoodEntryInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.PUT('/food-entries/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'delete_food_entry',
      {
        description: 'Delete a food diary entry by ID. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.DeleteFoodEntryInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.DELETE('/food-entries/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'copy_food_entries',
      {
        description: 'Copy food entries from one date to another, optionally filtered by meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.CopyFoodEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ from_date, to_date, ...rest }) =>
        result(await this.profileClient.POST('/food-entries/copy/v1', {
          params: {
            query: {
              ...rest,
              from_date: dateToDays(from_date),
              to_date: dateToDays(to_date)
            },
          },
        })),
    );

    this.server.registerTool(
      'copy_saved_meal_entries',
      {
        description: 'Copy entries from a saved meal to a meal on a specific date. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.CopySavedMealEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.POST('/food-entries/copy/saved-meal/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date) } },
        })),
    );
  }

  // ── Profile API – Favorites ──

  private registerFavoriteTools(): void {
    this.server.registerTool(
      'get_favorite_foods',
      {
        description: "Get the user's favorite foods. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetFavoriteFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () =>
        result(await this.profileClient.GET('/food/favorites/v2')),
    );

    this.server.registerTool(
      'add_favorite_food',
      {
        description: "Add a food to the user's favorites. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.AddFavoriteFoodInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.POST('/food/favorite/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'delete_favorite_food',
      {
        description: "Remove a food from the user's favorites. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.DeleteFavoriteFoodInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      // food.delete_favorite is DELETE; the Postman collection lists POST, which adds the food instead
      async (args) => toolResult(await this.profileRequest('DELETE', '/food/favorite/v1', args)),
    );

    this.server.registerTool(
      'get_most_eaten_foods',
      {
        description: "Get the user's most eaten foods, optionally filtered by meal. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetMostEatenFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.GET('/food/most-eaten/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_recently_eaten_foods',
      {
        description: "Get the user's recently eaten foods, optionally filtered by meal. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetRecentlyEatenFoodsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.GET('/food/recently-eaten/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_favorite_recipes',
      {
        description: "Get the user's favorite recipes. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetFavoriteRecipesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () =>
        result(await this.profileClient.GET('/recipe/favorites/v2')),
    );

    this.server.registerTool(
      'add_favorite_recipe',
      {
        description: "Add a recipe to the user's favorites. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.AddFavoriteRecipeInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.POST('/recipe/favorites/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'delete_favorite_recipe',
      {
        description: "Remove a recipe from the user's favorites. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.DeleteFavoriteRecipeInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.DELETE('/recipe/favorites/v1', {
          params: { query: args },
        })),
    );
  }

  // ── Profile API – Saved Meals ──

  private registerSavedMealTools(): void {
    this.server.registerTool(
      'get_saved_meals',
      {
        description: "Get the user's saved meals, optionally filtered by meal type. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetSavedMealsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.GET('/saved-meals/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'create_saved_meal',
      {
        description: 'Create a new saved meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.CreateSavedMealInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) =>
        result(await this.profileClient.POST('/saved-meals/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'edit_saved_meal',
      {
        description: 'Edit a saved meal name, description, or associated meals. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.EditSavedMealInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.PUT('/saved-meals/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'delete_saved_meal',
      {
        description: 'Delete a saved meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.DeleteSavedMealInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.DELETE('/saved-meals/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'get_saved_meal_items',
      {
        description: 'Get all food items in a saved meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetSavedMealItemsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.GET('/saved-meals/item/v2', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'add_saved_meal_item',
      {
        description: 'Add a food item to a saved meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.AddSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) =>
        result(await this.profileClient.POST('/saved-meals/item/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'edit_saved_meal_item',
      {
        description: 'Edit a food item in a saved meal (name or units). Cannot change serving_id. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.EditSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.PUT('/saved-meals/item/v1', {
          params: { query: args },
        })),
    );

    this.server.registerTool(
      'delete_saved_meal_item',
      {
        description: 'Remove a food item from a saved meal. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.DeleteSavedMealItemInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args) =>
        result(await this.profileClient.DELETE('/saved-meals/item/v1', {
          params: { query: args },
        })),
    );
  }

  // ── Profile API – Weight ──

  private registerWeightTools(): void {
    this.server.registerTool(
      'update_weight',
      {
        description: "Record the user's weight for a date. First weigh-in requires goal_weight_kg and current_height_cm. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.UpdateWeightInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.POST('/weight/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date) } },
        })),
    );

    this.server.registerTool(
      'get_weight_month',
      {
        description: "Get the user's weight entries for a month. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetWeightMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) =>
        result(await this.profileClient.GET('/weight/month/v2', {
          params: { query: { date: optionalDateToDays(date) } },
        })),
    );
  }

  // ── Profile API – Exercise ──

  private registerExerciseTools(): void {
    this.server.registerTool(
      'get_exercise_entries',
      {
        description: "Get the user's exercise diary entries for a date. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.GetExerciseEntriesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) => toolResult(await this.profileRequest('GET', '/exercise-entries/v2', { date: optionalDateToDays(date) })),
    );

    this.server.registerTool(
      'get_exercises',
      {
        description: 'Get the full list of supported exercise types and their IDs. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetExercisesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () =>
        result(await this.profileClient.GET('/exercises/v2')),
    );

    this.server.registerTool(
      'edit_exercise_entries',
      {
        description: 'Shift exercise time between activities for a date. Moves minutes from one exercise to another. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.EditExerciseEntriesInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.PUT('/exercise-entries/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date) } },
        })),
    );

    this.server.registerTool(
      'get_exercise_entries_month',
      {
        description: 'Get daily calories expended from exercise for a month. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetExerciseEntriesMonthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ date }) =>
        result(await this.profileClient.GET('/exercise-entries/month/v2', {
          params: { query: { date: optionalDateToDays(date) } },
        })),
    );

    this.server.registerTool(
      'save_exercise_template',
      {
        description: "Save the current day's exercise entries as a template for specified days of the week. Requires profile auth (check_auth_status first).",
        inputSchema: schemas.SaveExerciseTemplateInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ date, ...rest }) =>
        result(await this.profileClient.POST('/exercise-entries/day/v1', {
          params: { query: { ...rest, date: optionalDateToDays(date) } },
        })),
    );
  }

  // ── Profile API – Profile & Custom Food ──

  private registerProfileTools(): void {
    this.server.registerTool(
      'get_profile',
      {
        description: 'Get profile status information for the authenticated user. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.GetProfileInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () =>
        result(await this.profileClient.GET('/profile/v1')),
    );

    this.server.registerTool(
      'create_food',
      {
        description: 'Create a custom food with nutrition info. Premier exclusive. Requires profile auth (check_auth_status first).',
        inputSchema: schemas.CreateFoodInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args) =>
        result(await this.profileClient.POST('/food/v2', {
          params: { query: args },
        })),
    );
  }

  // ── Auth Tools ──

  private registerAuthTools(): void {
    this.server.registerTool(
      'check_auth_status',
      {
        description: 'Check if API credentials and profile authentication are configured. Call this first to understand what setup is needed.',
        inputSchema: schemas.CheckAuthStatusInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        const hasCredentials = this.hasApiCredentials();
        const hasTokens = !!(this.oauth1Credentials.accessToken && this.oauth1Credentials.accessTokenSecret);

        if (!hasCredentials) {
          return toolResult({
            credentials_configured: false,
            profile_authenticated: false,
            config_path: this.getConfigPath(),
            message: 'API credentials are not configured. Use setup_credentials to provide your FatSecret API keys. ' +
              'Get them at https://platform.fatsecret.com/ → My Account → API Keys. ' +
              'You need: Client ID, Client Secret (OAuth 2.0), and Consumer Secret (OAuth 1.0 — different from Client Secret).',
          });
        }

        return toolResult({
          credentials_configured: true,
          profile_authenticated: hasTokens,
          config_path: this.getConfigPath(),
          message: hasTokens
            ? 'Fully configured. API credentials and profile authentication are ready. All tools are available.'
            : 'API credentials configured (public tools work). Profile not authenticated — use start_auth to authorize profile access.',
        });
      },
    );

    this.server.registerTool(
      'setup_credentials',
      {
        description: 'Configure FatSecret API credentials. Get them at https://platform.fatsecret.com/ → My Account → API Keys. Saves to persistent config file.',
        inputSchema: schemas.SetupCredentialsInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ client_id, client_secret, consumer_secret }) => {
        this.clientId = client_id;
        this.clientSecret = client_secret;
        this.oauth1Credentials.consumerKey = client_id;
        this.oauth1Credentials.consumerSecret = consumer_secret;

        // Reset OAuth 2.0 token (new credentials)
        this.oauth2Token = null;
        this.oauth2TokenExpiry = 0;
        this.oauth2Pending = null;
        // New credentials may be on a different plan, so detect the scope again
        this.oauth2Scope = null;

        // Clear stale OAuth tokens when credentials change
        this.oauth1Credentials.accessToken = undefined;
        this.oauth1Credentials.accessTokenSecret = undefined;

        this.saveConfig({
          clientId: client_id,
          clientSecret: client_secret,
          consumerSecret: consumer_secret,
          accessToken: undefined,
          accessTokenSecret: undefined,
        });

        return toolResult({
          message: 'Credentials saved! Public API tools (food search, recipes) are now available. ' +
            'For profile tools (food diary, weight, etc.), use start_auth to authorize your FatSecret account.',
          config_path: this.getConfigPath(),
        });
      },
    );

    this.server.registerTool(
      'start_auth',
      {
        description: 'Start the OAuth 1.0 authorization flow for profile access. Returns an authorization URL the user must visit. Requires API credentials (setup_credentials first).',
        inputSchema: schemas.StartAuthInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false },
      },
      async () => {
        this.ensureApiCredentials();
        // Use only consumer key/secret for request token (no access tokens)
        const result = await requestToken({
          consumerKey: this.oauth1Credentials.consumerKey,
          consumerSecret: this.oauth1Credentials.consumerSecret,
        });
        this.pendingOAuth = { token: result.oauthToken, secret: result.oauthTokenSecret };
        return toolResult({
          message: 'Visit the URL below to authorize the app, then use complete_auth with the verifier code.',
          authorization_url: result.authorizationUrl,
        });
      },
    );

    this.server.registerTool(
      'complete_auth',
      {
        description: 'Complete the OAuth 1.0 flow with the verifier code from the authorization page.',
        inputSchema: schemas.CompleteAuthInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ verifier }) => {
        if (!this.pendingOAuth) {
          throw new Error('No pending OAuth flow. Call start_auth first.');
        }
        const result = await accessToken(
          this.oauth1Credentials,
          this.pendingOAuth.token,
          this.pendingOAuth.secret,
          verifier,
        );
        this.saveConfig({ accessToken: result.accessToken, accessTokenSecret: result.accessTokenSecret });
        this.oauth1Credentials.accessToken = result.accessToken;
        this.oauth1Credentials.accessTokenSecret = result.accessTokenSecret;
        this.pendingOAuth = null;
        return toolResult({
          message: 'Authentication successful! Profile tools are now available.',
          config_path: this.getConfigPath(),
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

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const server = new FatSecretMcpServer();
server.run().catch(console.error);
