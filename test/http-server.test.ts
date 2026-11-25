import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { serveHttp } from '../src/http-server.js';

async function startServer(): Promise<{ base: string; close: () => Promise<void> }> {
  const server = new McpServer({ name: 'test', version: '0' });
  server.registerTool('ping', { description: 'test tool', inputSchema: {} }, async () => ({
    content: [{ type: 'text' as const, text: 'pong' }],
  }));
  const http = serveHttp(server, 0);
  await once(http, 'listening');
  const port = (http.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => http.close(() => resolve())) };
}

function rpc(id: number | null, method: string, params?: unknown): Record<string, unknown> {
  const msg: Record<string, unknown> = { jsonrpc: '2.0', method };
  if (id !== null) msg.id = id;
  if (params !== undefined) msg.params = params;
  return msg;
}

async function post(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  // Stateless POST answers either plain JSON or a single SSE "message" event
  const data = text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
    .join('\n');
  return JSON.parse(data || text) as T;
}

test('stateless http: initialize → list → call, plus routing and parallel calls', async () => {
  const { base, close } = await startServer();
  try {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);

    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/mcp`)).status, 405);
    assert.equal((await post(base, 'not-json{')).status, 400);

    const init = await post(
      base,
      rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } }),
    );
    assert.equal(init.status, 200);
    const initJson = await readJson<{ result?: { serverInfo?: { name?: string } } }>(init);
    assert.equal(initJson.result?.serverInfo?.name, 'test');

    await post(base, rpc(null, 'notifications/initialized'));

    const list = await post(base, rpc(2, 'tools/list', {}));
    const listJson = await readJson<{ result?: { tools?: { name?: string }[] } }>(list);
    assert.deepEqual(listJson.result?.tools?.map((t) => t.name), ['ping']);

    // Parallel calls share one server instance: all must succeed, none may throw "Already connected"
    const calls = await Promise.all(
      [3, 4, 5].map((id) => post(base, rpc(id, 'tools/call', { name: 'ping', arguments: {} }))),
    );
    for (const res of calls) {
      assert.equal(res.status, 200);
      const json = await readJson<{ result?: { content?: { text?: string }[] } }>(res);
      assert.equal(json.result?.content?.[0]?.text, 'pong');
    }
  } finally {
    await close();
  }
});
