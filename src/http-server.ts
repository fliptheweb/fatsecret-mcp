import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// Stateless Streamable HTTP: one shared server, one in-flight request at a
// time. The SDK binds a transport to a single server instance, and our
// server keeps auth state (pendingOAuth, token cache) in memory, so
// concurrent requests must queue.
// shortcut: single-flight mutex; add a server pool if parallel batches feel slow.
export function serveHttp(server: McpServer, port: number): Server {
  let tail: Promise<void> = Promise.resolve();
  const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const http = createServer((req, res) => {
    void withLock(() => handleRequest(server, req, res)).catch((err) => {
      console.error('HTTP handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain' }).end('Internal Server Error');
      }
    });
  });
  http.on('error', (err) => {
    console.error(`Failed to listen on :${port}:`, err);
    process.exit(1);
  });
  http.listen(port, () => console.error(`FatSecret MCP server listening on :${port}`));
  return http;
}

async function handleRequest(server: McpServer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not Found');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST', 'content-type': 'text/plain' }).end('Method Not Allowed');
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    res.writeHead(413, { 'content-type': 'text/plain' }).end('Request body too large');
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('Invalid JSON');
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req, res, parsed);
  } finally {
    await server.close();
  }
}
