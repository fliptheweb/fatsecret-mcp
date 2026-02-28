import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from './server-factory.js';
import { handleMcpRequest, handleHealthRequest } from './http-server.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(handleMcpRequest, handleHealthRequest);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('HTTP Server', () => {
  it('responds to health check', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string; sessions: number };
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(typeof body.sessions, 'number');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    assert.strictEqual(res.status, 404);
  });

  it('returns 404 for invalid session ID', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': 'nonexistent-session-id',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    assert.strictEqual(res.status, 404);
  });

  it('handles CORS preflight', async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: 'OPTIONS' });
    assert.strictEqual(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'));
    assert.ok(res.headers.get('access-control-allow-methods'));
  });

  it('returns parse error for invalid JSON', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { jsonrpc: string; error: { code: number } };
    assert.strictEqual(body.error.code, -32700);
  });
});

describe('MCP Protocol', () => {
  it('initializes a session and lists tools via MCP client', async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);

    const tools = await client.listTools();
    assert.ok(tools.tools.length > 0, 'Should have at least one tool');

    // Verify public tools are present
    const toolNames = tools.tools.map((t) => t.name);
    assert.ok(toolNames.includes('search_foods'), 'Should have search_foods tool');
    assert.ok(toolNames.includes('get_food'), 'Should have get_food tool');
    assert.ok(toolNames.includes('search_recipes'), 'Should have search_recipes tool');

    // Verify auth tools are present
    assert.ok(toolNames.includes('check_auth_status'), 'Should have check_auth_status tool');
    assert.ok(toolNames.includes('start_auth'), 'Should have start_auth tool');
    assert.ok(toolNames.includes('complete_auth'), 'Should have complete_auth tool');

    // Verify setup_credentials is NOT present in HTTP mode
    assert.ok(!toolNames.includes('setup_credentials'), 'Should NOT have setup_credentials in HTTP mode');

    // Profile tools should be present
    assert.ok(toolNames.includes('get_food_entries'), 'Should have get_food_entries tool');
    assert.ok(toolNames.includes('get_weight_month'), 'Should have get_weight_month tool');

    await transport.terminateSession();
    await client.close();
  });

  it('check_auth_status returns server-managed credential info', async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);

    const result = await client.callTool({ name: 'check_auth_status', arguments: {} });
    assert.ok(result.content);
    assert.ok(Array.isArray(result.content));

    const textContent = result.content[0];
    assert.strictEqual(textContent.type, 'text');
    const data = JSON.parse((textContent as { type: 'text'; text: string }).text);

    // Without env vars set, credentials should not be configured
    assert.strictEqual(data.credentials_configured, false);
    assert.strictEqual(data.profile_authenticated, false);
    // Should NOT mention config_path in HTTP mode
    assert.strictEqual(data.config_path, undefined);
    // Should mention env vars, not setup_credentials
    assert.ok(
      data.message.includes('environment variables'),
      'Message should mention environment variables',
    );

    await transport.terminateSession();
    await client.close();
  });

  it('supports multiple independent sessions', async () => {
    const transport1 = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client1 = new Client({ name: 'test-client-1', version: '1.0.0' });
    await client1.connect(transport1);

    const transport2 = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    const client2 = new Client({ name: 'test-client-2', version: '1.0.0' });
    await client2.connect(transport2);

    // Both sessions should work independently
    const tools1 = await client1.listTools();
    const tools2 = await client2.listTools();
    assert.ok(tools1.tools.length > 0);
    assert.ok(tools2.tools.length > 0);
    assert.strictEqual(tools1.tools.length, tools2.tools.length);

    // Sessions should have different IDs
    assert.notStrictEqual(transport1.sessionId, transport2.sessionId);

    await transport1.terminateSession();
    await transport2.terminateSession();
    await client1.close();
    await client2.close();
  });
});
