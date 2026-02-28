#!/usr/bin/env npx tsx
/**
 * Splits the FatSecret Postman collection into separate collections by auth type,
 * then converts each to OpenAPI and generates typed REST clients.
 *
 * Schema source: https://www.postman.com/fatsecret/fatsecret-public-apis/
 * Usage: npx tsx scripts/split-collection.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: unknown;
  description?: string;
}

interface PostmanCollection {
  info: {
    _postman_id: string;
    name: string;
    description: string;
    schema: string;
    _exporter_id: string;
  };
  item: PostmanItem[];
}

const collection: PostmanCollection = JSON.parse(
  readFileSync(join(ROOT, 'schemas', 'fatsecret Platform.postman_collection.json'), 'utf-8'),
);

// Find the top-level sections
const oauth2Section = collection.item.find((i) => i.name === 'API Reference (OAuth 2.0)');
const oauth1_3legSection = collection.item.find(
  (i) => i.name === 'API Reference (3-Legged OAuth1.0)',
);

if (!oauth2Section?.item) throw new Error('OAuth 2.0 section not found');
if (!oauth1_3legSection?.item) throw new Error('3-Legged OAuth section not found');

// Filter out deprecated endpoints
function filterDeprecated(items: PostmanItem[]): PostmanItem[] {
  return items
    .filter((item) => !item.name.toLowerCase().includes('deprecated'))
    .map((item) => ({
      ...item,
      item: item.item ? filterDeprecated(item.item) : undefined,
    }));
}

// Remove OAuth flow steps (numbered items like "1. Request Token")
function filterOAuthFlow(items: PostmanItem[]): PostmanItem[] {
  return items.filter((item) => !item.name.match(/^\d+\.\s/));
}

// Create OAuth 2.0 public API collection
const publicCollection: PostmanCollection = {
  info: {
    ...collection.info,
    _postman_id: 'public-api',
    name: 'FatSecret Public API (OAuth 2.0)',
    description: 'Public food and recipe data endpoints using OAuth 2.0 Client Credentials.',
  },
  item: [
    {
      name: 'Foods',
      item: filterDeprecated(oauth2Section.item.find((i) => i.name === 'Foods')?.item || []),
    },
    {
      name: 'Food Brands',
      item: filterDeprecated(
        oauth2Section.item.find((i) => i.name === 'Food Brands')?.item || [],
      ),
    },
    {
      name: 'Food Categories',
      item: filterDeprecated(
        oauth2Section.item.find((i) => i.name === 'Food Categories')?.item || [],
      ),
    },
    {
      name: 'Food Sub Categories',
      item: filterDeprecated(
        oauth2Section.item.find((i) => i.name === 'Food Sub Categories')?.item || [],
      ),
    },
    {
      name: 'Recipes',
      item: filterDeprecated(oauth2Section.item.find((i) => i.name === 'Recipes')?.item || []),
    },
    {
      name: 'Recipe Types',
      item: filterDeprecated(
        oauth2Section.item.find((i) => i.name === 'Recipe Types')?.item || [],
      ),
    },
  ].filter((section) => section.item && section.item.length > 0),
};

// Create 3-Legged OAuth 1.0 profile API collection
const profileCollection: PostmanCollection = {
  info: {
    ...collection.info,
    _postman_id: 'profile-api',
    name: 'FatSecret Profile API (3-Legged OAuth 1.0)',
    description: 'User-specific endpoints using 3-Legged OAuth 1.0.',
  },
  item: filterOAuthFlow(
    filterDeprecated(oauth1_3legSection.item).filter(
      (section) => !section.name.match(/^\d+\.\s/),
    ),
  ),
};

// Write split collections
const publicPath = join(ROOT, 'schemas', 'public-api.postman.json');
const profilePath = join(ROOT, 'schemas', 'profile-api.postman.json');

import { mkdirSync } from 'node:fs';
mkdirSync(join(ROOT, 'schemas'), { recursive: true });

writeFileSync(publicPath, JSON.stringify(publicCollection, null, 2));
writeFileSync(profilePath, JSON.stringify(profileCollection, null, 2));

// Count endpoints
function countEndpoints(items: PostmanItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.item) count += countEndpoints(item.item);
    else if (item.request) count++;
  }
  return count;
}

console.log(`Public API (OAuth 2.0): ${countEndpoints(publicCollection.item)} endpoints → ${publicPath}`);
console.log(`Profile API (3-Leg OAuth 1.0): ${countEndpoints(profileCollection.item)} endpoints → ${profilePath}`);
