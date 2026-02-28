import { createServer as createHttpServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

/**
 * Creates a minimal HTTP server with JSON body parsing for the MCP endpoint.
 * Uses Node's built-in http module to avoid Express type dependency.
 */
export function createServer(
  mcpHandler: (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => Promise<void> | void,
  healthHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void,
): Server {
  return createHttpServer(async (req, res) => {
    // CORS headers for remote MCP clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, mcp-protocol-version');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health' && req.method === 'GET') {
      await healthHandler(req, res);
      return;
    }

    if (url.pathname === '/mcp') {
      // Parse JSON body for POST requests
      if (req.method === 'POST') {
        try {
          const body = await readBody(req);
          (req as IncomingMessage & { body?: unknown }).body = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }));
          return;
        }
      }
      await mcpHandler(req as IncomingMessage & { body?: unknown }, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
