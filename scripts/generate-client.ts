#!/usr/bin/env npx tsx
/**
 * Generates a typed REST client from the FatSecret Postman collection.
 * Schema source: https://www.postman.com/fatsecret/fatsecret-public-apis/
 *
 * Usage: npx tsx scripts/generate-client.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

interface PostmanQuery {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanUrlEncoded {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: PostmanQuery[];
}

interface PostmanRequest {
  method: string;
  header: { key: string; value: string }[];
  url: PostmanUrl | string;
  body?: { mode: string; urlencoded?: PostmanUrlEncoded[] };
  description?: string;
}

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

interface PostmanCollection {
  info: { name: string };
  item: PostmanItem[];
}

interface EndpointParam {
  name: string;
  value: string;
  description: string;
  required: boolean;
  disabled: boolean;
}

interface Endpoint {
  name: string;
  category: string;
  authType: 'oauth2' | 'oauth1' | 'oauth1_3leg';
  method: string;
  urlPath: string;
  params: EndpointParam[];
  description: string;
  deprecated: boolean;
  premier: boolean;
}

function extractEndpoints(items: PostmanItem[], path: string = ''): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const item of items) {
    const currentPath = path ? `${path}/${item.name}` : item.name;

    if (item.item) {
      endpoints.push(...extractEndpoints(item.item, currentPath));
    } else if (item.request) {
      const req = item.request;
      const url = typeof req.url === 'string' ? { raw: req.url, host: [], path: [], query: [] } : req.url;

      // Determine auth type from path
      let authType: Endpoint['authType'] = 'oauth2';
      if (currentPath.includes('3-Legged OAuth1.0')) authType = 'oauth1_3leg';
      else if (currentPath.includes('OAuth 1.0')) authType = 'oauth1';

      // Extract URL path (remove base_url_path variable)
      const urlPath = url.path?.join('/') || '';

      // Extract params from query and body
      const params: EndpointParam[] = [];

      if (url.query) {
        for (const q of url.query) {
          params.push({
            name: q.key,
            value: q.value,
            description: q.description || '',
            required: (q.description || '').toLowerCase().includes('required'),
            disabled: q.disabled || false,
          });
        }
      }

      if (req.body?.mode === 'urlencoded' && req.body.urlencoded) {
        for (const p of req.body.urlencoded) {
          params.push({
            name: p.key,
            value: p.value,
            description: p.description || '',
            required: (p.description || '').toLowerCase().includes('required'),
            disabled: p.disabled || false,
          });
        }
      }

      const deprecated = item.name.toLowerCase().includes('deprecated');
      const premier = item.name.includes('*');

      // Extract category from path
      const parts = currentPath.split('/');
      const category = parts.length > 2 ? parts[1] : parts[0];

      endpoints.push({
        name: item.name,
        category,
        authType,
        method: req.method,
        urlPath,
        params,
        description: req.description || '',
        deprecated,
        premier,
      });
    }
  }

  return endpoints;
}

function toMethodName(name: string, urlPath: string): string {
  // Clean the name - remove version suffixes, deprecated tags, asterisks
  let clean = name.replace(/\s*\(deprecated\)/gi, '').replace(/\*/g, '').trim();

  // Convert to camelCase
  clean = clean
    .replace(/\s+v\d+$/i, '') // remove trailing version
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toLowerCase());

  return clean;
}

function getVersion(urlPath: string): string {
  const match = urlPath.match(/v(\d+)/);
  return match ? match[0] : '';
}

function inferTsType(name: string, value: string, description: string): string {
  const desc = description.toLowerCase();
  if (name === 'format') return "'json'";

  // Booleans
  if (value === 'true' || value === 'false' || desc.includes('default false') || desc.includes('default true') || desc.includes('true or false')) {
    return 'boolean';
  }

  // Enums
  if (name === 'food_type') return "'none' | 'generic' | 'brand'";
  if (name === 'brand_type') return "'manufacturer' | 'restaurant' | 'supermarket'";
  if (name === 'meal') return "'breakfast' | 'lunch' | 'dinner' | 'other'";
  if (name === 'weight_type') return "'kg' | 'lb'";
  if (name === 'height_type') return "'cm' | 'inch'";
  if (name === 'sort_by') return "'newest' | 'oldest' | 'caloriesPerServingAscending' | 'caloriesPerServingDescending'";

  // Numbers
  if (name.endsWith('_id') || name === 'page_number' || name === 'max_results' ||
      name === 'date' || name === 'from_date' || name === 'to_date' ||
      name === 'days' || name === 'minutes' || name === 'kcal' ||
      desc.includes('kcal') || desc.includes('kg') || desc.includes('μg') ||
      desc.includes('mg') || desc.includes(', g') || desc.includes('decimal') ||
      name.startsWith('calories') || name.startsWith('carb') || name.startsWith('protein') ||
      name.startsWith('fat') || name.startsWith('prep_time') ||
      name.startsWith('current_weight') || name.startsWith('goal_weight') ||
      name.startsWith('current_height') || name === 'number_of_units' ||
      name === 'saturated_fat' || name === 'polyunsaturated_fat' || name === 'monounsaturated_fat' ||
      name === 'trans_fat' || name === 'cholesterol' || name === 'sodium' || name === 'potassium' ||
      name === 'fiber' || name === 'sugar' || name === 'added_sugars' ||
      name === 'vitamin_d' || name === 'vitamin_a' || name === 'vitamin_c' ||
      name === 'calcium' || name === 'iron' || name === 'calories_from_fat') {
    return 'number';
  }

  return 'string';
}

function generateClient(endpoints: Endpoint[]): string {
  // Filter to latest versions only (non-deprecated), deduplicate OAuth2 endpoints
  const latestEndpoints = new Map<string, Endpoint>();

  for (const ep of endpoints) {
    if (ep.deprecated) continue;

    // Skip OAuth 1.0 duplicates of OAuth 2.0 endpoints (keep 3-legged ones)
    if (ep.authType === 'oauth1' && !ep.urlPath.includes('profile') && !ep.urlPath.includes('food-entries') &&
        !ep.urlPath.includes('exercise') && !ep.urlPath.includes('weight') &&
        !ep.urlPath.includes('favorite') && !ep.urlPath.includes('saved-meal') &&
        !ep.urlPath.includes('recently-eaten') && !ep.urlPath.includes('most-eaten')) {
      // Check if there's an OAuth2 version
      const oauth2Key = `oauth2:${ep.urlPath}`;
      if (latestEndpoints.has(oauth2Key)) continue;
    }

    const key = `${ep.authType}:${ep.urlPath}`;
    const existing = latestEndpoints.get(key);

    if (!existing) {
      latestEndpoints.set(key, ep);
    } else {
      // Keep higher version
      const existingVer = parseInt(getVersion(existing.urlPath).replace('v', '') || '0');
      const newVer = parseInt(getVersion(ep.urlPath).replace('v', '') || '0');
      if (newVer > existingVer) {
        latestEndpoints.set(key, ep);
      }
    }
  }

  const uniqueEndpoints = Array.from(latestEndpoints.values());

  // Group by auth type
  const oauth2Endpoints = filteredEndpoints.filter(e => e.authType === 'oauth2');
  const oauth1Endpoints = filteredEndpoints.filter(e => e.authType === 'oauth1_3leg');

  let output = `// Auto-generated from FatSecret Postman Collection
// Schema source: https://www.postman.com/fatsecret/fatsecret-public-apis/
// Generated: ${new Date().toISOString().split('T')[0]}
// Do not edit manually - regenerate with: npx tsx scripts/generate-client.ts

import { buildOAuth1Headers, type OAuth1Credentials } from '../oauth1.js';

const REST_BASE_URL = 'https://platform.fatsecret.com/rest';
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

interface OAuth2Token {
  accessToken: string;
  expiresAt: number;
}

export interface FatSecretConfig {
  clientId: string;
  clientSecret: string;
  oauth1AccessToken?: string;
  oauth1AccessTokenSecret?: string;
}

/**
 * Converts a YYYY-MM-DD date string to "days since January 1, 1970"
 * as required by FatSecret profile endpoints.
 */
export function dateToDaysSinceEpoch(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z');
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Converts "days since January 1, 1970" back to YYYY-MM-DD.
 */
export function daysSinceEpochToDate(days: number): string {
  const date = new Date(days * 1000 * 60 * 60 * 24);
  return date.toISOString().split('T')[0];
}

`;

  // Filter out OAuth flow endpoints
  const filteredEndpoints = uniqueEndpoints.filter(ep =>
    !ep.urlPath.includes('request_token') &&
    !ep.urlPath.includes('authorize') &&
    !ep.urlPath.includes('access_token') &&
    !ep.name.match(/^\d+\.?\s/)  // Skip numbered OAuth flow steps like "1. Request Token"
  );

  // Generate param interfaces (deduplicated)
  const allInterfaces: string[] = [];
  const seenInterfaces = new Set<string>();

  for (const ep of filteredEndpoints) {
    const methodName = toMethodName(ep.name, ep.urlPath);
    const interfaceName = `${methodName.charAt(0).toUpperCase() + methodName.slice(1)}Params`;

    if (seenInterfaces.has(interfaceName)) continue;
    seenInterfaces.add(interfaceName);

    const activeParams = ep.params.filter(p => p.name !== 'format' && p.name !== 'method');
    if (activeParams.length === 0) continue;

    // Deduplicate params by name
    const seenParams = new Set<string>();
    const deduped = activeParams.filter(p => {
      if (seenParams.has(p.name)) return false;
      seenParams.add(p.name);
      return true;
    });

    let iface = `export interface ${interfaceName} {\n`;
    for (const p of deduped) {
      const tsType = inferTsType(p.name, p.value, p.description);
      const optional = !p.required || p.disabled ? '?' : '';
      const desc = p.description ? ` /** ${p.description} */` : '';
      iface += `${desc}\n  ${p.name}${optional}: ${tsType};\n`;
    }
    iface += '}\n';
    allInterfaces.push(iface);
  }

  output += allInterfaces.join('\n');

  // Generate client class
  output += `
export class FatSecretClient {
  private config: FatSecretConfig;
  private oauth2Token: OAuth2Token | null = null;

  constructor(config: FatSecretConfig) {
    this.config = config;
  }

  get hasOAuth1Credentials(): boolean {
    return !!(this.config.oauth1AccessToken && this.config.oauth1AccessTokenSecret);
  }

  setOAuth1Tokens(accessToken: string, accessTokenSecret: string): void {
    this.config.oauth1AccessToken = accessToken;
    this.config.oauth1AccessTokenSecret = accessTokenSecret;
  }

  private async getOAuth2Token(): Promise<string> {
    if (this.oauth2Token && Date.now() < this.oauth2Token.expiresAt - 60_000) {
      return this.oauth2Token.accessToken;
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'basic premier barcode',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`OAuth2 token request failed: \${response.status} \${text}\`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.oauth2Token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.oauth2Token.accessToken;
  }

  private async requestOAuth2(
    urlPath: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' = 'GET',
  ): Promise<unknown> {
    const token = await this.getOAuth2Token();
    params.format = 'json';

    const url = new URL(\`\${REST_BASE_URL}/\${urlPath}\`);
    if (method === 'GET') {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: method === 'POST' ? new URLSearchParams(params) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`FatSecret API error: \${response.status} \${text}\`);
    }

    return response.json();
  }

  async requestOAuth1(
    urlPath: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  ): Promise<unknown> {
    if (!this.hasOAuth1Credentials) {
      throw new Error(
        'OAuth 1.0 credentials not available. Complete the OAuth flow first using start_oauth_flow and complete_oauth_flow tools.',
      );
    }

    const credentials: OAuth1Credentials = {
      consumerKey: this.config.clientId,
      consumerSecret: this.config.clientSecret,
      accessToken: this.config.oauth1AccessToken,
      accessTokenSecret: this.config.oauth1AccessTokenSecret,
    };

    params.format = 'json';
    const url = \`\${REST_BASE_URL}/\${urlPath}\`;
    const authHeader = buildOAuth1Headers(method, url, credentials, params);

    const fullUrl = new URL(url);
    if (method === 'GET' || method === 'DELETE') {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.set(key, value);
      }
    }

    const response = await fetch(fullUrl.toString(), {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: method === 'POST' || method === 'PUT' ? new URLSearchParams(params) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(\`FatSecret API error: \${response.status} \${text}\`);
    }

    return response.json();
  }

`;

  // Generate OAuth 2.0 methods
  const seenMethods = new Set<string>();

  output += '  // =============================================\n';
  output += '  // Public data methods (OAuth 2.0)\n';
  output += '  // =============================================\n\n';

  for (const ep of oauth2Endpoints) {
    const methodName = toMethodName(ep.name, ep.urlPath);
    const activeParams = ep.params.filter(p => p.name !== 'format' && p.name !== 'method');
    const interfaceName = `${methodName.charAt(0).toUpperCase() + methodName.slice(1)}Params`;
    const hasParams = activeParams.length > 0;
    const hasRequiredParams = activeParams.some(p => p.required && !p.disabled);

    const paramSig = hasParams
      ? `params${hasRequiredParams ? '' : '?'}: ${interfaceName}`
      : '';

    if (seenMethods.has(methodName)) continue;
    seenMethods.add(methodName);

    output += `  /** ${ep.name}${ep.premier ? ' (Premier)' : ''} */\n`;
    output += `  async ${methodName}(${paramSig}) {\n`;
    output += `    const p: Record<string, string> = {};\n`;

    // Deduplicate params
    const seenParamNames = new Set<string>();
    for (const param of activeParams) {
      if (seenParamNames.has(param.name)) continue;
      seenParamNames.add(param.name);
      const tsType = inferTsType(param.name, param.value, param.description);
      if (tsType === 'boolean') {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name}) p.${param.name} = 'true';\n`;
      } else if (tsType === 'number') {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name} !== undefined) p.${param.name} = String(params.${param.name});\n`;
      } else {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name}) p.${param.name} = params.${param.name};\n`;
      }
    }

    output += `    return this.requestOAuth2('${ep.urlPath}', p);\n`;
    output += `  }\n\n`;
  }

  // Generate OAuth 1.0 3-legged methods
  output += '  // =============================================\n';
  output += '  // Profile methods (OAuth 1.0 three-legged)\n';
  output += '  // =============================================\n\n';

  for (const ep of oauth1Endpoints) {
    // Skip OAuth flow endpoints (request_token, authorize, access_token)
    if (ep.urlPath.includes('request_token') || ep.urlPath.includes('authorize') || ep.urlPath.includes('access_token')) {
      continue;
    }

    const methodName = toMethodName(ep.name, ep.urlPath);
    const activeParams = ep.params.filter(p => p.name !== 'format' && p.name !== 'method');
    const interfaceName = `${methodName.charAt(0).toUpperCase() + methodName.slice(1)}Params`;
    const hasParams = activeParams.length > 0;
    const hasRequiredParams = activeParams.some(p => p.required && !p.disabled);

    const paramSig = hasParams
      ? `params${hasRequiredParams ? '' : '?'}: ${interfaceName}`
      : '';

    // Check if any date params need conversion
    const dateParams = activeParams.filter(p =>
      (p.name === 'date' || p.name === 'from_date' || p.name === 'to_date') &&
      p.description.includes('days since')
    );

    if (seenMethods.has(methodName)) continue;
    seenMethods.add(methodName);

    output += `  /** ${ep.name}${ep.premier ? ' (Premier)' : ''} */\n`;
    output += `  async ${methodName}(${paramSig}) {\n`;
    output += `    const p: Record<string, string> = {};\n`;

    // Deduplicate params
    const seenParamNames = new Set<string>();
    for (const param of activeParams) {
      if (seenParamNames.has(param.name)) continue;
      seenParamNames.add(param.name);
      const tsType = inferTsType(param.name, param.value, param.description);
      const isDateParam = dateParams.some(d => d.name === param.name);

      if (isDateParam) {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name} !== undefined) p.${param.name} = String(typeof params.${param.name} === 'string' ? dateToDaysSinceEpoch(params.${param.name} as unknown as string) : params.${param.name});\n`;
      } else if (tsType === 'boolean') {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name}) p.${param.name} = 'true';\n`;
      } else if (tsType === 'number') {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name} !== undefined) p.${param.name} = String(params.${param.name});\n`;
      } else {
        output += `    if (params${hasRequiredParams ? '' : '?'}.${param.name}) p.${param.name} = params.${param.name};\n`;
      }
    }

    const httpMethod = ep.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE';
    output += `    return this.requestOAuth1('${ep.urlPath}', p, '${httpMethod}');\n`;
    output += `  }\n\n`;
  }

  output += '}\n';

  return output;
}

// Main
const collectionPath = join(ROOT, 'fatsecret Platform.postman_collection.json');
const collection: PostmanCollection = JSON.parse(readFileSync(collectionPath, 'utf-8'));

const endpoints = extractEndpoints(collection.item);
console.log(`Found ${endpoints.length} total endpoints`);

const nonDeprecated = endpoints.filter(e => !e.deprecated);
console.log(`${nonDeprecated.length} non-deprecated endpoints`);

const clientCode = generateClient(endpoints);

const outputPath = join(ROOT, 'src', 'generated', 'client.ts');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, clientCode);

console.log(`Generated client: ${outputPath}`);
console.log(`Total lines: ${clientCode.split('\n').length}`);
