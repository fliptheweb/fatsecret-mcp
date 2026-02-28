#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FatSecretMcpServer } from './index.js';
import { createServer } from './server-factory.js';

const sessions = new Map<
  string,
  { server: FatSecretMcpServer; transport: StreamableHTTPServerTransport }
>();

export function getSessionCount(): number {
  return sessions.size;
}

export async function handleMcpRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Route to existing session
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      await session.transport.handleRequest(req, res, req.body);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session not found. Client must reinitialize.' },
        }),
      );
    }
    return;
  }

  // New session initialization
  const mcpServer = new FatSecretMcpServer({ persistConfig: false });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { server: mcpServer, transport });
      console.log(`Session created: ${newSessionId} (active: ${sessions.size})`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.log(`Session closed: ${transport.sessionId} (active: ${sessions.size})`);
    }
  };

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export function handleHealthRequest(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
}

export function startServer(port?: number): ReturnType<typeof createServer> {
  const p = port ?? parseInt(process.env.PORT || '3000', 10);
  const server = createServer(handleMcpRequest, handleHealthRequest);
  server.listen(p, '0.0.0.0', () => {
    console.log(`FatSecret MCP HTTP server listening on http://0.0.0.0:${p}/mcp`);
  });
  return server;
}

// Start server when run directly (not when imported by tests)
const entrypoint = process.argv[1] ?? '';
if (entrypoint.endsWith('http-server.ts') || entrypoint.endsWith('http-server.js')) {
  startServer();
}
