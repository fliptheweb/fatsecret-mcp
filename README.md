# FatSecret MCP Server <img src="https://cdn.prod.website-files.com/6854cb4b7a1b8e39612d89cf/685543fddca41e9e9ce5ae5f_fatsecret_logo-op.png" alt="FatSecret Logo" height="28" />

> [!IMPORTANT]
> This is **not an official MCP server** by FatSecret.
> It uses the [FatSecret Platform API](https://platform.fatsecret.com/) which requires a free developer account.

An MCP (Model Context Protocol) server that connects Claude/Cursor to the [FatSecret Platform API](https://platform.fatsecret.com/). Search foods, track your diet, manage recipes, and monitor weight directly from your AI assistant.

**Available on NPM**: `npx fatsecret-mcp` | **Claude Desktop Extension**: [fatsecret-mcp.mcpb](https://github.com/fliptheweb/fatsecret-mcp/releases/latest/download/fatsecret-mcp.mcpb)

## Features

- **Food Search** - Search FatSecret's extensive food database with detailed nutrition data
- **Barcode Lookup** - Find foods by GTIN-13 barcode
- **Recipe Search** - Browse and filter recipes by calories, macros, and prep time
- **Food Diary** - Add, edit, copy, and delete food diary entries
- **Saved Meals** - Create and manage reusable meal templates
- **Weight Tracking** - Record and view weight history
- **Exercise Tracking** - View exercises and manage activity entries
- **Favorites** - Manage favorite foods and recipes

## Quick Start

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "fatsecret": {
      "command": "npx",
      "args": ["-y", "fatsecret-mcp"]
    }
  }
}
```

That's it! On first use, the AI will guide you through setup:

1. **`check_auth_status`** — detects missing credentials and tells you what to do
2. **`setup_credentials`** — you provide your API keys (saved to `~/.fatsecret-mcp/config.json`)
3. **`start_auth`** → **`complete_auth`** — authorize your FatSecret account for diary/weight tools

Alternatively, you can pass credentials as environment variables:

```json
{
  "mcpServers": {
    "fatsecret": {
      "command": "npx",
      "args": ["-y", "fatsecret-mcp"],
      "env": {
        "FATSECRET_CLIENT_ID": "your_client_id",
        "FATSECRET_CLIENT_SECRET": "your_client_secret",
        "FATSECRET_CONSUMER_SECRET": "your_consumer_secret"
      }
    }
  }
}
```

### Where to Get Credentials

1. Create a free account at [platform.fatsecret.com](https://platform.fatsecret.com/)
2. Navigate to **My Account → API Keys**
3. You'll see three values:
   - **Client ID** (used for both OAuth 2.0 and OAuth 1.0)
   - **Client Secret** (OAuth 2.0 - for public food/recipe search)
   - **Consumer Secret** (OAuth 1.0 - for user profile/diary access, **different** from Client Secret)

### Claude Desktop (Extension)

Download and open [fatsecret-mcp.mcpb](https://github.com/fliptheweb/fatsecret-mcp/releases/latest/download/fatsecret-mcp.mcpb) with Claude Desktop. You'll be prompted to enter your FatSecret credentials — secrets are stored securely in the OS keychain.

See [Building Desktop Extensions with MCPB](https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb) for more details.

### Claude Desktop (Manual)

`~/Library/Application Support/Claude/claude_desktop_config.json`

### Claude Code (CLI)

```bash
claude mcp add fatsecret -- npx -y fatsecret-mcp
```

Or with env vars:

```bash
claude mcp add fatsecret \
  -e FATSECRET_CLIENT_ID=your_client_id \
  -e FATSECRET_CLIENT_SECRET=your_client_secret \
  -e FATSECRET_CONSUMER_SECRET=your_consumer_secret \
  -- npx -y fatsecret-mcp
```

Verify with `claude mcp list`.

### Cursor

- **Settings UI** — `Settings → MCP → + Add new MCP server`, then fill in the command, args, and env
- **Project config** — add JSON to `.cursor/mcp.json` in your project root
- **Global config** — add JSON to `~/.cursor/mcp.json`

## Available Tools

### Setup & Auth

| Tool | Description |
|------|-------------|
| `check_auth_status` | Check if credentials and profile auth are configured. **Call this first.** |
| `setup_credentials` | Save FatSecret API credentials (Client ID, Client Secret, Consumer Secret) to persistent config |
| `start_auth` | Start OAuth 1.0 authorization — returns URL for user to visit |
| `complete_auth` | Complete OAuth with verifier PIN from authorization page |

### Public API (OAuth 2.0 — no user auth needed)

| Tool | Description |
|------|-------------|
| `search_foods` | Search the food database |
| `get_food` | Get detailed nutrition info for a food |
| `find_food_by_barcode` | Find food by GTIN-13 barcode |
| `autocomplete_foods` | Get search autocomplete suggestions |
| `search_recipes` | Search recipes with filters |
| `get_recipe` | Get recipe details with ingredients |
| `get_food_categories` | Get food categories |
| `get_food_sub_categories` | Get food sub categories |
| `get_brands` | Get food brands |
| `get_recipe_types` | Get recipe types |

### Food Diary (requires profile auth)

| Tool | Description |
|------|-------------|
| `get_food_entries` | Get food diary entries for a date |
| `get_food_entries_month` | Get monthly nutrition summary (calories & macros per day) |
| `create_food_entry` | Add a food diary entry |
| `edit_food_entry` | Edit a food diary entry |
| `delete_food_entry` | Delete a food diary entry |
| `copy_food_entries` | Copy entries from one date to another |
| `copy_saved_meal_entries` | Copy a saved meal to a date |

### Favorites (requires profile auth)

| Tool | Description |
|------|-------------|
| `get_favorite_foods` | Get favorite foods |
| `delete_favorite_food` | Remove food from favorites |
| `get_most_eaten_foods` | Get most eaten foods |
| `get_recently_eaten_foods` | Get recently eaten foods |
| `get_favorite_recipes` | Get favorite recipes |
| `add_favorite_recipe` | Add recipe to favorites |
| `delete_favorite_recipe` | Remove recipe from favorites |

### Saved Meals (requires profile auth)

| Tool | Description |
|------|-------------|
| `get_saved_meals` | Get saved meals |
| `create_saved_meal` | Create a saved meal |
| `edit_saved_meal` | Edit a saved meal |
| `delete_saved_meal` | Delete a saved meal |
| `get_saved_meal_items` | Get items in a saved meal |
| `add_saved_meal_item` | Add food to a saved meal |
| `edit_saved_meal_item` | Edit saved meal item |
| `delete_saved_meal_item` | Remove item from saved meal |

### Weight & Exercise (requires profile auth)

| Tool | Description |
|------|-------------|
| `update_weight` | Record weight for a date |
| `get_weight_month` | Get weight history for a month |
| `get_exercises` | Get exercise types |
| `edit_exercise_entries` | Shift exercise time between activities |
| `get_exercise_entries_month` | Get exercise data for a month |
| `save_exercise_template` | Save exercise template for weekdays |

### Profile & Custom Food (requires profile auth)

| Tool | Description |
|------|-------------|
| `get_profile` | Get user profile info |
| `create_food` | Create a custom food (Premier) |

<sub>API reference: [FatSecret Postman Collection](https://www.postman.com/fatsecret/fatsecret-public-apis/)</sub>

## Test Connection

```bash
npx fatsecret-mcp
```

Or with env vars:

```bash
FATSECRET_CLIENT_ID='...' FATSECRET_CLIENT_SECRET='...' FATSECRET_CONSUMER_SECRET='...' npx fatsecret-mcp
```

## Requirements

- Node.js 18+
- FatSecret Platform API account ([platform.fatsecret.com](https://platform.fatsecret.com/))
- MCP-compatible client (Claude Desktop, Cursor, etc.)

## Development

1. Clone the repository
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials
4. `npm run dev` to run in development mode

Debugging with MCP Inspector:

```bash
FATSECRET_CLIENT_ID=X FATSECRET_CLIENT_SECRET=X FATSECRET_CONSUMER_SECRET=X npx -y @modelcontextprotocol/inspector npx <local-path>/fatsecret-mcp
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
